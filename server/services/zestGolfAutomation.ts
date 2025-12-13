import puppeteer, { Browser, Page } from "puppeteer";

const ZEST_CM_URL = "https://cm.zest.golf";
const LOGIN_URL = `${ZEST_CM_URL}/login`;
const FACILITY_LIST_URL = `${ZEST_CM_URL}/management/myFacilityList`;

export interface ZestPendingFacility {
  id: string;
  name: string;
  country: string;
  city: string;
  status: string;
  holes: number;
  onZestSince: string;
}

export interface ZestAutomationResult {
  success: boolean;
  message: string;
  facilitiesProcessed?: number;
  facilities?: ZestPendingFacility[];
  error?: string;
}

export class ZestGolfAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async login(): Promise<boolean> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    const username = process.env.ZEST_GOLF_USERNAME;
    const password = process.env.ZEST_GOLF_PASSWORD;

    if (!username || !password) {
      throw new Error("Zest Golf credentials not configured");
    }

    try {
      console.log("Navigating to Zest Golf login page...");
      await this.page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 30000 });

      await this.page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 10000 });
      
      const emailInput = await this.page.$('input[type="email"]') || 
                         await this.page.$('input[name="email"]') ||
                         await this.page.$('input[placeholder*="email" i]');
      
      const passwordInput = await this.page.$('input[type="password"]');

      if (!emailInput || !passwordInput) {
        console.log("Login form not found, trying alternative selectors...");
        const inputs = await this.page.$$('input');
        if (inputs.length >= 2) {
          await inputs[0].type(username, { delay: 50 });
          await inputs[1].type(password, { delay: 50 });
        } else {
          throw new Error("Could not find login form inputs");
        }
      } else {
        await emailInput.type(username, { delay: 50 });
        await passwordInput.type(password, { delay: 50 });
      }

      const submitButton = await this.page.$('button[type="submit"]') ||
                           await this.page.$('input[type="submit"]') ||
                           await this.page.$('button:has-text("Login")') ||
                           await this.page.$('button:has-text("Sign in")');

      if (submitButton) {
        await submitButton.click();
      } else {
        await this.page.keyboard.press("Enter");
      }

      await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });

      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes("/login");
      
      if (isLoggedIn) {
        console.log("Successfully logged into Zest Golf");
      } else {
        console.log("Login may have failed, still on login page");
      }

      return isLoggedIn;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  async getPendingFacilities(): Promise<ZestPendingFacility[]> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      console.log("Navigating to facility list...");
      await this.page.goto(`${FACILITY_LIST_URL}?tab=2`, { 
        waitUntil: "networkidle2", 
        timeout: 30000 
      });

      await this.page.waitForSelector("table", { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const facilities = await this.page.evaluate(() => {
        const rows = document.querySelectorAll("table tbody tr");
        const result: any[] = [];

        rows.forEach((row) => {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 6) {
            const nameCell = cells[0];
            const nameLink = nameCell.querySelector("a");
            const name = nameLink?.textContent?.trim() || nameCell.textContent?.trim() || "";
            
            const idMatch = nameLink?.href?.match(/facility\/(\d+)/);
            const id = idMatch ? idMatch[1] : "";

            result.push({
              id,
              name,
              country: cells[1]?.textContent?.trim() || "",
              city: cells[2]?.textContent?.trim() || "",
              status: cells[3]?.textContent?.trim() || "",
              holes: parseInt(cells[5]?.textContent?.trim() || "0") || 0,
              onZestSince: cells[6]?.textContent?.trim() || "",
            });
          }
        });

        return result;
      });

      console.log(`Found ${facilities.length} pending facilities`);
      return facilities;
    } catch (error) {
      console.error("Error getting pending facilities:", error);
      return [];
    }
  }

  async resendInviteToFacility(facilityId: string): Promise<boolean> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      const row = await this.page.$(`tr:has(a[href*="facility/${facilityId}"])`);
      if (!row) {
        console.log(`Facility ${facilityId} row not found`);
        return false;
      }

      const menuButton = await row.$('button[aria-label*="menu"], button:has(svg), .dropdown-trigger, [data-testid*="menu"]');
      if (menuButton) {
        await menuButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const resendOption = await this.page.$('text=Resend') ||
                             await this.page.$('[data-testid*="resend"]') ||
                             await this.page.$('button:has-text("Resend")');
        
        if (resendOption) {
          await resendOption.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Error resending invite to facility ${facilityId}:`, error);
      return false;
    }
  }

  async resendMailToAllFacilities(): Promise<ZestAutomationResult> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      console.log("Looking for 'Resend Mail To All Facilities' button...");
      
      const resendAllButton = await this.page.$('button:has-text("Resend Mail To All Facilities")') ||
                              await this.page.$('[data-testid*="resend-all"]') ||
                              await this.page.$('button.btn-warning:has-text("Resend")');

      if (!resendAllButton) {
        const buttons = await this.page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent);
          if (text && text.toLowerCase().includes('resend')) {
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return {
              success: true,
              message: "Triggered resend mail to all facilities",
              facilitiesProcessed: 0,
            };
          }
        }
        
        return {
          success: false,
          message: "Could not find 'Resend Mail To All Facilities' button",
          error: "Button not found",
        };
      }

      await resendAllButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const confirmButton = await this.page.$('button:has-text("Confirm")') ||
                            await this.page.$('button:has-text("Yes")') ||
                            await this.page.$('button:has-text("OK")') ||
                            await this.page.$('.modal button.btn-primary');

      if (confirmButton) {
        await confirmButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return {
        success: true,
        message: "Successfully triggered resend mail to all pending facilities",
      };
    } catch (error) {
      console.error("Error resending mail to all facilities:", error);
      return {
        success: false,
        message: "Failed to resend mail to all facilities",
        error: String(error),
      };
    }
  }

  async markFacilitiesAsOutreachSent(): Promise<ZestAutomationResult> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      const facilities = await this.getPendingFacilities();
      
      if (facilities.length === 0) {
        return {
          success: true,
          message: "No pending facilities found",
          facilitiesProcessed: 0,
          facilities: [],
        };
      }

      const resendResult = await this.resendMailToAllFacilities();
      
      return {
        success: resendResult.success,
        message: resendResult.success 
          ? `Processed ${facilities.length} pending facilities - resent invites`
          : resendResult.message,
        facilitiesProcessed: facilities.length,
        facilities,
        error: resendResult.error,
      };
    } catch (error) {
      console.error("Error marking facilities as outreach sent:", error);
      return {
        success: false,
        message: "Failed to process facilities",
        error: String(error),
      };
    }
  }

  async runFullAutomation(): Promise<ZestAutomationResult> {
    try {
      await this.initialize();
      
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        await this.close();
        return {
          success: false,
          message: "Failed to log into Zest Golf",
          error: "Login failed - check credentials",
        };
      }

      const result = await this.markFacilitiesAsOutreachSent();
      
      await this.close();
      return result;
    } catch (error) {
      await this.close();
      return {
        success: false,
        message: "Automation failed",
        error: String(error),
      };
    }
  }

  async testConnection(): Promise<ZestAutomationResult> {
    try {
      await this.initialize();
      
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        await this.close();
        return {
          success: false,
          message: "Failed to log into Zest Golf",
          error: "Login failed - check credentials",
        };
      }

      const facilities = await this.getPendingFacilities();
      
      await this.close();
      return {
        success: true,
        message: `Connected successfully. Found ${facilities.length} pending facilities.`,
        facilitiesProcessed: facilities.length,
        facilities,
      };
    } catch (error) {
      await this.close();
      return {
        success: false,
        message: "Connection test failed",
        error: String(error),
      };
    }
  }
}

let automationInstance: ZestGolfAutomation | null = null;

export function getZestGolfAutomation(): ZestGolfAutomation {
  if (!automationInstance) {
    automationInstance = new ZestGolfAutomation();
  }
  return automationInstance;
}
