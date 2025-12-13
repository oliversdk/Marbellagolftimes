import puppeteer, { Browser, Page } from "puppeteer";

const ZEST_CM_URL = "https://cm.zest.golf";
const ZEST_WWW_URL = "https://www.zest.golf";
// Try www.zest.golf login first as that's the main entry point
const LOGIN_URLS = [
  `${ZEST_WWW_URL}/login`,
  `${ZEST_CM_URL}/login`,
];
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

    // Try each login URL until one works
    for (const loginUrl of LOGIN_URLS) {
      console.log(`Trying login URL: ${loginUrl}`);
      const success = await this.tryLoginAtUrl(loginUrl, username, password);
      if (success) {
        return true;
      }
    }

    return false;
  }

  private async tryLoginAtUrl(loginUrl: string, username: string, password: string): Promise<boolean> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      console.log(`Navigating to: ${loginUrl}`);
      await this.page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Page title:", await this.page.title());
      console.log("Page URL:", this.page.url());
      
      // Try multiple selector strategies for the login form
      let usernameInput = null;
      let passwordInput = null;
      
      // Strategy 1: Look for common input selectors (prioritize placeholder text from screenshot)
      const usernameSelectors = [
        'input[placeholder*="Username" i]',
        'input[placeholder*="Enter Username" i]',
        'input[name="username"]',
        'input[name="user"]',
        'input[id*="user" i]',
        'input[type="text"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
      ];
      
      for (const selector of usernameSelectors) {
        usernameInput = await this.page.$(selector);
        if (usernameInput) {
          console.log(`Found username input with selector: ${selector}`);
          break;
        }
      }
      
      // Look for password input
      const passwordSelectors = [
        'input[type="password"]',
        'input[placeholder*="Password" i]',
        'input[name="password"]',
      ];
      
      for (const selector of passwordSelectors) {
        passwordInput = await this.page.$(selector);
        if (passwordInput) {
          console.log(`Found password input with selector: ${selector}`);
          break;
        }
      }
      
      // Strategy 2: Find all visible inputs if specific selectors fail
      if (!usernameInput || !passwordInput) {
        console.log("Trying fallback: looking for all text inputs...");
        const allInputs = await this.page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])');
        console.log(`Found ${allInputs.length} visible inputs`);
        
        for (const input of allInputs) {
          const inputType = await input.evaluate((el) => (el as HTMLInputElement).type);
          const inputName = await input.evaluate((el) => (el as HTMLInputElement).name);
          const inputId = await input.evaluate((el) => (el as HTMLInputElement).id);
          const inputPlaceholder = await input.evaluate((el) => (el as HTMLInputElement).placeholder);
          console.log(`Input: type=${inputType}, name=${inputName}, id=${inputId}, placeholder=${inputPlaceholder}`);
          
          if (inputType === 'password') {
            passwordInput = input;
          } else if (!usernameInput && (inputType === 'text' || inputType === 'email')) {
            usernameInput = input;
          }
        }
      }

      if (!usernameInput || !passwordInput) {
        console.log("Could not find login form inputs on this URL");
        const screenshotPath = '/tmp/zest-login-debug.png';
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
        return false;
      }
      
      // Clear and type credentials
      console.log("Entering username...");
      await usernameInput.click({ clickCount: 3 }); // Select all
      await usernameInput.type(username, { delay: 50 });
      
      console.log("Entering password...");
      await passwordInput.click({ clickCount: 3 }); // Select all
      await passwordInput.type(password, { delay: 50 });

      // Wait a moment for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find and click submit element - could be button, input, or other element
      let foundButton = false;
      
      // First, log all clickable elements for debugging
      const debugInfo = await this.page.evaluate(() => {
        const elements: string[] = [];
        const allClickable = document.querySelectorAll('button, input[type="submit"], a, [role="button"], [type="submit"]');
        allClickable.forEach(el => {
          const tag = el.tagName;
          const text = el.textContent?.trim().substring(0, 50) || '';
          const className = el.className?.toString().substring(0, 50) || '';
          const type = (el as HTMLInputElement).type || '';
          elements.push(`${tag}[type=${type}][class=${className}]: "${text}"`);
        });
        return elements;
      });
      console.log("Found clickable elements:", debugInfo);
      
      // Strategy 1: Try to find button by common patterns
      // Look for button elements that could be the login button
      const buttonSelectors = [
        'button[type="submit"]',
        'form button',
        'button:not([type="button"])',
        '.login-button',
        '[class*="login"]',
        '[class*="submit"]',
        'button.btn',
        'button.btn-primary',
        'button.btn-warning',
        'a.btn',
      ];
      
      for (const selector of buttonSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          const text = await btn.evaluate(el => el.textContent?.trim() || '');
          console.log(`Found button with selector "${selector}": "${text}"`);
          if (text.toLowerCase().includes('log') || text.toLowerCase().includes('sign')) {
            console.log("Clicking this login button...");
            await btn.click();
            foundButton = true;
            break;
          }
        }
      }
      
      // Strategy 2: Look for ANY button/link with "Log In" text using XPath-style search
      if (!foundButton) {
        const loginButtonClicked = await this.page.evaluate(() => {
          // Search ALL elements and find those with login-related text
          const allElements = document.querySelectorAll('*');
          for (const el of Array.from(allElements)) {
            const text = el.textContent?.trim().toLowerCase() || '';
            const directText = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent?.trim())
              .join(' ')
              .toLowerCase();
            
            // Check if this element directly contains "log in" (not inherited from children)
            if ((directText.includes('log in') || directText === 'login') && 
                (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'DIV' || el.tagName === 'SPAN')) {
              (el as HTMLElement).click();
              return { found: true, tag: el.tagName, text: el.textContent?.trim() };
            }
          }
          
          // Fallback: click any element that has "log in" anywhere in its text
          for (const el of Array.from(allElements)) {
            const text = el.textContent?.trim().toLowerCase() || '';
            if ((text === 'log in' || text === 'login') && 
                (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SPAN' || el.tagName === 'DIV')) {
              (el as HTMLElement).click();
              return { found: true, tag: el.tagName, text: el.textContent?.trim() };
            }
          }
          
          return { found: false };
        });
        
        if (loginButtonClicked.found) {
          console.log(`Found and clicked login element: ${loginButtonClicked.tag} - "${loginButtonClicked.text}"`);
          foundButton = true;
        }
      }
      
      // Strategy 3: Look for input[type="submit"]
      if (!foundButton) {
        const submitInput = await this.page.$('input[type="submit"]');
        if (submitInput) {
          const value = await submitInput.evaluate(el => (el as HTMLInputElement).value || '');
          console.log(`Found input[type="submit"] with value: "${value}"`);
          await submitInput.click();
          foundButton = true;
        }
      }
      
      // Strategy 4: Submit the form directly
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
      
      // Strategy 5: Press Tab then Enter to submit
      if (!foundButton) {
        console.log("No submit button found, pressing Tab then Enter");
        await this.page.keyboard.press("Tab");
        await new Promise(resolve => setTimeout(resolve, 200));
        await this.page.keyboard.press("Enter");
      }

      // Wait for navigation or page change
      try {
        await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
      } catch (e) {
        console.log("Navigation timeout, checking if already logged in...");
      }

      // Check if login was successful
      const currentUrl = this.page.url();
      console.log("Current URL after login attempt:", currentUrl);
      
      // Check for success indicators
      const isLoggedIn = !currentUrl.includes("/login") && 
                         (currentUrl.includes("management") || 
                          currentUrl.includes("dashboard") ||
                          currentUrl.includes("home") ||
                          currentUrl.includes("cm.zest.golf"));
      
      if (isLoggedIn) {
        console.log("Successfully logged into Zest Golf!");
        return true;
      }
      
      // Check for error messages on page
      const errorMessage = await this.page.evaluate(() => {
        const errorEl = document.querySelector('.error, .alert-danger, [class*="error"], [class*="Error"]');
        return errorEl?.textContent?.trim() || null;
      });
      
      if (errorMessage) {
        console.log("Login error message:", errorMessage);
      }
      
      console.log("Login may have failed, still on login page");
      await this.page.screenshot({ path: '/tmp/zest-login-failed.png', fullPage: true });
      return false;
      
    } catch (error) {
      console.error("Login error:", error);
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
