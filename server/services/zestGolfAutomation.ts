import puppeteer, { Browser, Page } from "puppeteer";

const ZEST_CM_URL = "https://cm.zest.golf";
const LOGIN_URL = `${ZEST_CM_URL}/login`;
const FACILITY_LIST_URL = `${ZEST_CM_URL}/management/myFacilityList`;

let isAutomationRunning = false;

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

export function validateZestCredentials(): { valid: boolean; error?: string } {
  const username = process.env.ZEST_GOLF_USERNAME;
  const password = process.env.ZEST_GOLF_PASSWORD;
  
  if (!username) {
    return { valid: false, error: "ZEST_GOLF_USERNAME environment variable not set" };
  }
  if (!password) {
    return { valid: false, error: "ZEST_GOLF_PASSWORD environment variable not set" };
  }
  return { valid: true };
}

export function isAutomationBusy(): boolean {
  return isAutomationRunning;
}

export class ZestGolfAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    if (isAutomationRunning) {
      throw new Error("Another automation task is already running");
    }
    isAutomationRunning = true;
    
    try {
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
    } catch (error) {
      isAutomationRunning = false;
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } finally {
      this.browser = null;
      this.page = null;
      isAutomationRunning = false;
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

      // Wait for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Log the page content for debugging
      const pageContent = await this.page.content();
      console.log("Page title:", await this.page.title());
      console.log("Page URL:", this.page.url());
      
      // Try multiple selector strategies for the login form
      let emailInput = null;
      let passwordInput = null;
      
      // Strategy 1: Look for common input selectors
      const inputSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[id*="email"]',
        'input[id*="user"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="user" i]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
      ];
      
      for (const selector of inputSelectors) {
        emailInput = await this.page.$(selector);
        if (emailInput) {
          console.log(`Found email input with selector: ${selector}`);
          break;
        }
      }
      
      passwordInput = await this.page.$('input[type="password"]');
      
      // Strategy 2: Find all visible inputs if specific selectors fail
      if (!emailInput) {
        console.log("Trying fallback: looking for all text inputs...");
        const allInputs = await this.page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        console.log(`Found ${allInputs.length} visible inputs`);
        
        for (const input of allInputs) {
          const inputType = await input.evaluate((el) => (el as HTMLInputElement).type);
          const inputName = await input.evaluate((el) => (el as HTMLInputElement).name);
          const inputId = await input.evaluate((el) => (el as HTMLInputElement).id);
          console.log(`Input: type=${inputType}, name=${inputName}, id=${inputId}`);
          
          if (inputType !== 'password' && !emailInput) {
            emailInput = input;
          }
          if (inputType === 'password') {
            passwordInput = input;
          }
        }
      }

      if (!emailInput || !passwordInput) {
        console.log("Could not find login form inputs");
        // Take a screenshot for debugging
        const screenshotPath = '/tmp/zest-login-debug.png';
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
        throw new Error("Could not find login form inputs on Zest Golf page");
      }
      
      // Clear and type credentials
      await emailInput.click({ clickCount: 3 }); // Select all
      await emailInput.type(username, { delay: 30 });
      
      await passwordInput.click({ clickCount: 3 }); // Select all
      await passwordInput.type(password, { delay: 30 });

      // Wait a moment for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find and click submit element - could be button, input, or other element
      let foundButton = false;
      
      // Strategy 1: Look for input[type="submit"]
      const submitInput = await this.page.$('input[type="submit"]');
      if (submitInput) {
        const value = await submitInput.evaluate(el => (el as HTMLInputElement).value || '');
        console.log(`Found input[type="submit"] with value: "${value}"`);
        await submitInput.click();
        foundButton = true;
      }
      
      // Strategy 2: Look for any element containing "Log" text
      if (!foundButton) {
        const loginElement = await this.page.evaluateHandle(() => {
          const allElements = document.querySelectorAll('button, input, a, div[role="button"], span[role="button"]');
          for (const el of Array.from(allElements)) {
            const text = el.textContent?.toLowerCase() || '';
            const value = (el as HTMLInputElement).value?.toLowerCase() || '';
            if (text.includes('log in') || text.includes('login') || 
                value.includes('log in') || value.includes('login')) {
              return el;
            }
          }
          return null;
        });
        
        const element = loginElement.asElement();
        if (element) {
          console.log("Found login element by text search, clicking...");
          await element.click();
          foundButton = true;
        }
      }
      
      // Strategy 3: Submit the form directly
      if (!foundButton) {
        const form = await this.page.$('form');
        if (form) {
          console.log("Submitting form directly...");
          await this.page.evaluate(() => {
            const formEl = document.querySelector('form');
            if (formEl) formEl.submit();
          });
          foundButton = true;
        }
      }
      
      if (!foundButton) {
        console.log("No submit button found, pressing Enter");
        await this.page.keyboard.press("Enter");
      }

      // Wait for navigation or page change
      try {
        await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
      } catch (e) {
        console.log("Navigation timeout, checking if already logged in...");
      }

      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes("/login");
      
      if (isLoggedIn) {
        console.log("Successfully logged into Zest Golf");
      } else {
        console.log("Login may have failed, still on login page:", currentUrl);
        // Take screenshot on failure
        await this.page.screenshot({ path: '/tmp/zest-login-failed.png', fullPage: true });
      }

      return isLoggedIn;
    } catch (error) {
      console.error("Login error:", error);
      // Take screenshot on error
      if (this.page) {
        try {
          await this.page.screenshot({ path: '/tmp/zest-login-error.png', fullPage: true });
        } catch {}
      }
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

  async analyzeNetworkRequests(): Promise<{ success: boolean; apiCalls: NetworkCall[]; message: string }> {
    const apiCalls: NetworkCall[] = [];
    
    try {
      await this.initialize();
      
      if (!this.page) {
        throw new Error("Browser not initialized");
      }

      await this.page.setRequestInterception(true);
      
      this.page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/') || url.includes('/management/')) {
          apiCalls.push({
            method: request.method(),
            url: url,
            postData: request.postData() || undefined,
            headers: request.headers(),
            timestamp: new Date().toISOString(),
          });
        }
        request.continue();
      });

      this.page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') || url.includes('/management/')) {
          const call = apiCalls.find(c => c.url === url && !c.status);
          if (call) {
            call.status = response.status();
            try {
              const text = await response.text();
              if (text.length < 5000) {
                call.responseBody = text;
              } else {
                call.responseBody = text.substring(0, 5000) + "... [truncated]";
              }
            } catch {}
          }
        }
      });

      const loginSuccess = await this.login();
      if (!loginSuccess) {
        await this.close();
        return {
          success: false,
          apiCalls,
          message: "Login failed",
        };
      }

      console.log("Navigating to facility list to capture API calls...");
      await this.page.goto(`${FACILITY_LIST_URL}?tab=2`, { 
        waitUntil: "networkidle2", 
        timeout: 30000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      const rows = await this.page.$$("table tbody tr");
      if (rows.length > 0) {
        const firstRow = rows[0];
        const menuBtn = await firstRow.$('button[aria-label*="menu"], button:has(svg[data-icon="ellipsis"]), .dropdown-trigger, td:last-child button');
        if (menuBtn) {
          console.log("Clicking menu button to capture API calls...");
          await menuBtn.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const menuItems = await this.page.$$('[role="menuitem"], .dropdown-item, .menu-item');
          for (const item of menuItems) {
            const text = await item.evaluate(el => el.textContent);
            console.log(`Found menu item: ${text}`);
          }
          
          await this.page.keyboard.press("Escape");
        }
      }

      await this.close();
      
      const uniqueEndpoints = Array.from(new Set(apiCalls.map(c => `${c.method} ${new URL(c.url).pathname}`)));
      
      return {
        success: true,
        apiCalls,
        message: `Captured ${apiCalls.length} API calls. Found ${uniqueEndpoints.length} unique endpoints: ${uniqueEndpoints.join(', ')}`,
      };
    } catch (error) {
      await this.close();
      return {
        success: false,
        apiCalls,
        message: `Analysis failed: ${String(error)}`,
      };
    }
  }
}

export interface NetworkCall {
  method: string;
  url: string;
  postData?: string;
  headers: Record<string, string>;
  timestamp: string;
  status?: number;
  responseBody?: string;
}

let automationInstance: ZestGolfAutomation | null = null;

export function getZestGolfAutomation(): ZestGolfAutomation {
  if (!automationInstance) {
    automationInstance = new ZestGolfAutomation();
  }
  return automationInstance;
}
