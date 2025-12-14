import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

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
          "--disable-blink-features=AutomationControlled",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
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

  async getCommissionRates(): Promise<{ success: boolean; rates: ZestCommissionRate[]; message: string }> {
    const rates: ZestCommissionRate[] = [];
    
    try {
      await this.initialize();
      
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        await this.close();
        return {
          success: false,
          rates: [],
          message: "Failed to log into Zest Golf",
        };
      }

      console.log("Navigating to commission rates page...");
      await this.page!.goto("https://cm.zest.golf/management/commissionPerCourse", { 
        waitUntil: "networkidle2", 
        timeout: 30000 
      });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take screenshot for debugging
      await this.page!.screenshot({ path: '/tmp/zest-commission-page.png', fullPage: true });
      console.log("Screenshot saved to /tmp/zest-commission-page.png");

      // Log page content for debugging
      const pageTitle = await this.page!.title();
      const pageUrl = this.page!.url();
      console.log(`Commission page: ${pageTitle} - ${pageUrl}`);

      // Try to extract data from table
      const tableData = await this.page!.evaluate(() => {
        const results: any[] = [];
        
        // Look for table rows
        const tables = document.querySelectorAll("table");
        console.log(`Found ${tables.length} tables`);
        
        tables.forEach((table, tableIdx) => {
          const rows = table.querySelectorAll("tbody tr");
          rows.forEach((row, rowIdx) => {
            const cells = row.querySelectorAll("td");
            const rowData: string[] = [];
            cells.forEach(cell => {
              rowData.push(cell.textContent?.trim() || "");
            });
            if (rowData.length > 0) {
              results.push({ tableIdx, rowIdx, cells: rowData });
            }
          });
        });

        // Also look for any cards or divs with rate info
        const cards = document.querySelectorAll('[class*="card"], [class*="rate"], [class*="commission"]');
        cards.forEach((card, idx) => {
          results.push({ 
            type: 'card', 
            idx, 
            text: card.textContent?.substring(0, 500) 
          });
        });

        return results;
      });

      console.log("Extracted data:", JSON.stringify(tableData, null, 2));

      // Parse the table data into commission rates
      for (const row of tableData) {
        if (row.cells && row.cells.length >= 2) {
          const rate: ZestCommissionRate = {
            courseName: row.cells[0] || "Unknown",
            commissionPercent: parseFloat(row.cells[1]?.replace('%', '')) || null,
            greenFeeRate: row.cells[2] || null,
            buggyRate: row.cells[3] || null,
            otherRates: row.cells.slice(4).join(', ') || null,
          };
          rates.push(rate);
        }
      }

      await this.close();
      
      return {
        success: true,
        rates,
        message: `Found ${rates.length} commission rates. Raw data logged for analysis.`,
      };
    } catch (error) {
      await this.close();
      return {
        success: false,
        rates: [],
        message: `Failed to get commission rates: ${String(error)}`,
      };
    }
  }

  async scrapeFacilityContacts(facilityId: number): Promise<ZestContactScrapeResult> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    try {
      console.log(`[Zest Portal Scraper] Navigating to Partners tab for facility ${facilityId}...`);
      
      // Navigate to facility list page with Partners tab (tab=1)
      await this.page.goto(`${ZEST_CM_URL}/management/myFacilityList?tab=1`, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const currentUrl = this.page.url();
      console.log(`[Zest Portal Scraper] Current URL: ${currentUrl}`);

      if (currentUrl.includes("/login")) {
        return {
          success: false,
          facilityId,
          contacts: [],
          error: "Session expired - need to re-login",
        };
      }

      await this.page.screenshot({ path: `/tmp/zest-facility-${facilityId}-list.png`, fullPage: true });
      console.log(`[Zest Portal Scraper] Screenshot of facility list saved`);

      // Find the facility row by ID and click the ellipsis menu (zest-icon-button in last cell)
      const menuButtonClicked = await this.page.evaluate((targetId: number) => {
        const rows = document.querySelectorAll('vaadin-grid-cell-content');
        let targetRow: Element | null = null;
        
        // Find the row containing this facility ID
        for (const cell of Array.from(rows)) {
          const text = cell.textContent?.trim() || '';
          if (text === String(targetId)) {
            // Found the ID cell, now find the parent row
            targetRow = cell.closest('tr') || cell.closest('vaadin-grid-row');
            break;
          }
        }
        
        // Look for ellipsis menu button in all rows if specific ID not found
        const allRows = document.querySelectorAll('tr, vaadin-grid-row');
        for (const row of Array.from(allRows)) {
          const cells = row.querySelectorAll('td, vaadin-grid-cell-content');
          const lastCell = cells[cells.length - 1];
          if (lastCell) {
            const menuBtn = lastCell.querySelector('zest-icon-button, button[icon="ellipsis-v"], [class*="ellipsis"]');
            if (menuBtn) {
              (menuBtn as HTMLElement).click();
              return { clicked: true, note: 'Clicked ellipsis menu' };
            }
          }
        }
        
        // Fallback: click any zest-icon-button
        const anyMenuBtn = document.querySelector('zest-icon-button');
        if (anyMenuBtn) {
          (anyMenuBtn as HTMLElement).click();
          return { clicked: true, note: 'Clicked first zest-icon-button' };
        }
        
        return { clicked: false };
      }, facilityId);

      console.log(`[Zest Portal Scraper] Menu button click result:`, menuButtonClicked);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.page.screenshot({ path: `/tmp/zest-facility-${facilityId}-panel.png`, fullPage: true });

      // Click on Contacts tab (index 5 in vaadin-tabs)
      const contactsTabClicked = await this.page.evaluate(() => {
        // Try vaadin-tab elements first
        const vaadinTabs = document.querySelectorAll('vaadin-tab');
        if (vaadinTabs.length > 5) {
          (vaadinTabs[5] as HTMLElement).click();
          return { clicked: true, method: 'vaadin-tab index 5' };
        }
        
        // Fallback: look for "Contacts" text
        const allTabs = document.querySelectorAll('vaadin-tab, [role="tab"], button, a');
        for (const tab of Array.from(allTabs)) {
          const text = tab.textContent?.trim().toLowerCase() || '';
          if (text === 'contacts' || text === 'contact') {
            (tab as HTMLElement).click();
            return { clicked: true, method: 'text match' };
          }
        }
        return { clicked: false };
      });

      console.log(`[Zest Portal Scraper] Contacts tab clicked:`, contactsTabClicked);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for Vaadin to load
      await this.page.screenshot({ path: `/tmp/zest-facility-${facilityId}-contacts.png`, fullPage: true });
      console.log(`[Zest Portal Scraper] Screenshot of contacts panel saved`);

      // STRATEGY 1: Try to access Vaadin's client-side state
      const vaadinStateData = await this.page.evaluate(() => {
        const result: any = { method: 'vaadin-state', contacts: [], debug: {} };
        
        try {
          // Access Vaadin Flow clients
          const vaadinObj = (window as any).Vaadin;
          if (vaadinObj && vaadinObj.Flow && vaadinObj.Flow.clients) {
            const clients = vaadinObj.Flow.clients;
            result.debug.hasVaadinClients = true;
            result.debug.clientKeys = Object.keys(clients);
            
            // Try to traverse the component tree
            for (const clientKey of Object.keys(clients)) {
              const client = clients[clientKey];
              if (client && client.getByNodeId) {
                result.debug.hasGetByNodeId = true;
              }
            }
          }
        } catch (e) {
          result.debug.vaadinError = String(e);
        }
        
        return result;
      });
      console.log(`[Zest Portal Scraper] Vaadin state probe:`, JSON.stringify(vaadinStateData.debug));

      // STRATEGY 2: Extract values from vaadin-text-field elements using CDP
      const textFieldValues = await this.page.evaluate(() => {
        const values: any[] = [];
        
        // Query all text fields and inputs
        const textFields = document.querySelectorAll('vaadin-text-field, vaadin-email-field, input[type="text"], input[type="email"], input[type="tel"]');
        
        textFields.forEach((field, idx) => {
          const el = field as HTMLInputElement;
          const value = el.value || '';
          const label = field.getAttribute('label') || field.getAttribute('placeholder') || '';
          const inputInner = field.querySelector('input');
          const innerValue = inputInner ? inputInner.value : '';
          
          values.push({
            index: idx,
            tagName: field.tagName,
            value: value,
            innerValue: innerValue,
            label: label,
          });
        });
        
        return values;
      });
      console.log(`[Zest Portal Scraper] Found ${textFieldValues.length} text fields`);

      // STRATEGY 3: Try getting values via CDP (Chrome DevTools Protocol)
      const cdpSession = await this.page.createCDPSession();
      
      // Get document for CDP queries
      const { root } = await cdpSession.send('DOM.getDocument');
      
      // Search for input elements with pierce: selector
      let cdpInputValues: any[] = [];
      try {
        const { nodeIds } = await cdpSession.send('DOM.querySelectorAll', {
          nodeId: root.nodeId,
          selector: 'input',
        });
        
        for (const nodeId of nodeIds.slice(0, 30)) { // Limit to first 30
          try {
            const { attributes } = await cdpSession.send('DOM.getAttributes', { nodeId });
            const attrMap: Record<string, string> = {};
            for (let i = 0; i < attributes.length; i += 2) {
              attrMap[attributes[i]] = attributes[i + 1];
            }
            
            // Get the value using JS
            const { result } = await cdpSession.send('Runtime.evaluate', {
              expression: `document.querySelector('[data-testid="${attrMap['data-testid']}"]')?.value || document.querySelectorAll('input')[${nodeIds.indexOf(nodeId)}]?.value || ''`,
            });
            
            cdpInputValues.push({
              nodeId,
              type: attrMap['type'],
              value: result?.value || '',
            });
          } catch {}
        }
      } catch (e) {
        console.log(`[Zest Portal Scraper] CDP query error:`, e);
      }
      
      await cdpSession.detach();
      console.log(`[Zest Portal Scraper] CDP found ${cdpInputValues.length} inputs`);

      // STRATEGY 4: Parse visible text for contact information
      const visibleTextData = await this.page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        
        // Look for email patterns
        const emails = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        
        // Look for phone patterns (Spanish format)
        const phones = bodyText.match(/\+?[\d\s()-]{9,}/g) || [];
        
        // Look for names near contact headers
        const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
        const contactSections: any = {};
        
        let currentSection = '';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineLower = line.toLowerCase();
          
          if (lineLower.includes('primary contact')) currentSection = 'Primary';
          else if (lineLower.includes('billing contact')) currentSection = 'Billing';
          else if (lineLower.includes('reservations contact')) currentSection = 'Reservations';
          
          if (currentSection && !contactSections[currentSection]) {
            contactSections[currentSection] = { lines: [] };
          }
          if (currentSection) {
            contactSections[currentSection].lines.push(line);
          }
        }
        
        return {
          emails: emails.slice(0, 10),
          phones: phones.slice(0, 10),
          contactSections,
          sampleText: bodyText.substring(0, 3000),
        };
      });
      
      console.log(`[Zest Portal Scraper] Found emails:`, visibleTextData.emails);
      console.log(`[Zest Portal Scraper] Found phones:`, visibleTextData.phones);
      console.log(`[Zest Portal Scraper] Contact sections:`, Object.keys(visibleTextData.contactSections));

      // Use page.evaluate with string function to avoid esbuild __name helper issues
      // The Zest panel has sections: PRIMARY CONTACT, BILLING CONTACT, RESERVATIONS CONTACT
      // Each section has fields: First Name, Last Name, Email, Phone
      const scrapedData = await this.page.evaluate(new Function(`
        var contacts = [];
        var pageText = document.body.textContent || "";
        
        // Helper function to find the value after a label
        function findFieldValue(sectionText, fieldName) {
          var lines = sectionText.split('\\n').map(function(l) { return l.trim(); }).filter(Boolean);
          for (var i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().indexOf(fieldName.toLowerCase()) !== -1) {
              // The value is typically on the next line or in the same element
              if (i + 1 < lines.length && lines[i + 1].length > 0) {
                var nextLine = lines[i + 1];
                // Skip if next line is another field label
                if (nextLine.toLowerCase().indexOf('name') === -1 && 
                    nextLine.toLowerCase().indexOf('email') === -1 && 
                    nextLine.toLowerCase().indexOf('phone') === -1) {
                  return nextLine;
                }
              }
            }
          }
          return null;
        }

        // Find contact sections by looking for the headers
        function parseContactSection(sectionName) {
          var sectionHeader = sectionName.toUpperCase() + ' CONTACT';
          var bodyText = document.body.textContent || '';
          var headerIndex = bodyText.indexOf(sectionHeader);
          
          if (headerIndex === -1) return null;
          
          // Find the next section or end
          var nextSections = ['PRIMARY CONTACT', 'BILLING CONTACT', 'RESERVATIONS CONTACT', 'Organization', 'Booking Conditions'];
          var endIndex = bodyText.length;
          
          for (var i = 0; i < nextSections.length; i++) {
            if (nextSections[i].toUpperCase() !== sectionHeader) {
              var nextIdx = bodyText.indexOf(nextSections[i], headerIndex + sectionHeader.length);
              if (nextIdx !== -1 && nextIdx < endIndex) {
                endIndex = nextIdx;
              }
            }
          }
          
          var sectionText = bodyText.substring(headerIndex, endIndex);
          
          // Extract fields - look for input values or text after labels
          var firstName = null;
          var lastName = null;
          var email = null;
          var phone = null;
          
          // Get all inputs in the panel
          var allInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
          var inputValues = [];
          for (var j = 0; j < allInputs.length; j++) {
            var inp = allInputs[j];
            if (inp.value && inp.value.trim()) {
              inputValues.push(inp.value.trim());
            }
          }
          
          // Parse the section text for field values
          var lines = sectionText.split('\\n').map(function(l) { return l.trim(); }).filter(Boolean);
          var currentField = null;
          
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var lineLower = line.toLowerCase();
            
            if (lineLower === 'first name' || lineLower.indexOf('first name') !== -1) {
              currentField = 'firstName';
            } else if (lineLower === 'last name' || lineLower.indexOf('last name') !== -1) {
              currentField = 'lastName';
            } else if (lineLower === 'email') {
              currentField = 'email';
            } else if (lineLower === 'phone') {
              currentField = 'phone';
            } else if (currentField && line.length > 0) {
              // This is a value
              if (currentField === 'firstName' && !firstName) firstName = line;
              else if (currentField === 'lastName' && !lastName) lastName = line;
              else if (currentField === 'email' && !email && line.indexOf('@') !== -1) email = line;
              else if (currentField === 'phone' && !phone && line.match(/^\\+?\\d/)) phone = line;
              currentField = null;
            }
          }
          
          // Combine first and last name
          var fullName = null;
          if (firstName && lastName) {
            fullName = firstName + ' ' + lastName;
          } else if (firstName) {
            fullName = firstName;
          } else if (lastName) {
            fullName = lastName;
          }
          
          if (fullName || email || phone) {
            return {
              role: sectionName,
              name: fullName,
              email: email,
              phone: phone
            };
          }
          return null;
        }

        // Parse each contact type
        var primary = parseContactSection('Primary');
        if (primary) contacts.push(primary);
        
        var billing = parseContactSection('Billing');
        if (billing) contacts.push(billing);
        
        var reservations = parseContactSection('Reservations');
        if (reservations) contacts.push(reservations);

        // Get facility name from the panel header
        var facilityNameEl = document.querySelector('h1, h2, h3, [class*="title"], [class*="header"]');
        var facilityName = null;
        if (facilityNameEl) {
          var nameText = facilityNameEl.textContent || '';
          if (nameText.toLowerCase().indexOf('details') !== -1) {
            facilityName = nameText.replace(/details/i, '').trim();
          } else {
            facilityName = nameText.trim();
          }
        }

        var pageHtml = document.body.innerHTML.substring(0, 15000);

        return {
          contacts: contacts,
          facilityName: facilityName,
          debugHtml: pageHtml
        };
      `) as () => { contacts: Array<{ role: string; name: string | null; email: string | null; phone: string | null }>; facilityName: string | null; debugHtml: string });

      console.log(`[Zest Portal Scraper] Scraped ${scrapedData.contacts.length} contacts for facility ${facilityId}`);
      
      // Combine all extracted data to build contacts
      const finalContacts: ZestScrapedContact[] = [];
      
      // First, try the old text-based scraping result
      if (scrapedData.contacts.length > 0) {
        for (const c of scrapedData.contacts) {
          if (c.name || c.email || c.phone) {
            finalContacts.push({
              role: c.role as "Primary" | "Billing" | "Reservations",
              name: c.name,
              email: c.email,
              phone: c.phone,
            });
          }
        }
      }
      
      // If no contacts found yet, try to match emails/phones from visible text to contact sections
      if (finalContacts.length === 0 && (visibleTextData.emails.length > 0 || visibleTextData.phones.length > 0)) {
        console.log(`[Zest Portal Scraper] Attempting to build contacts from visible text data...`);
        
        const roles = ['Primary', 'Billing', 'Reservations'];
        const usedEmails = new Set<string>();
        const usedPhones = new Set<string>();
        
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          const sectionData = visibleTextData.contactSections[role];
          
          let email: string | null = null;
          let phone: string | null = null;
          let name: string | null = null;
          
          // Find email for this section
          if (sectionData && sectionData.lines) {
            for (const line of sectionData.lines) {
              const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch && !usedEmails.has(emailMatch[0])) {
                email = emailMatch[0];
                usedEmails.add(email as string);
                break;
              }
            }
            
            // Find phone for this section
            for (const line of sectionData.lines) {
              const phoneMatch = line.match(/\+?[\d\s()-]{9,}/);
              if (phoneMatch && !usedPhones.has(phoneMatch[0].trim())) {
                phone = phoneMatch[0].trim();
                usedPhones.add(phone as string);
                break;
              }
            }
            
            // Try to find a name (line that doesn't look like label, email, or phone)
            for (const line of sectionData.lines) {
              const lineLower = line.toLowerCase();
              if (!lineLower.includes('contact') && 
                  !lineLower.includes('name') && 
                  !lineLower.includes('email') && 
                  !lineLower.includes('phone') &&
                  !line.includes('@') &&
                  !/^\+?[\d\s()-]+$/.test(line) &&
                  line.length > 2 && line.length < 50) {
                // Looks like it could be a name
                const words = line.split(' ');
                if (words.length >= 1 && words.length <= 4 && words.every((w: string) => /^[A-Za-zÀ-ÿ]+$/.test(w))) {
                  name = line;
                  break;
                }
              }
            }
          }
          
          // Fallback: assign from global lists if section didn't have specific data
          if (!email && visibleTextData.emails.length > i && !usedEmails.has(visibleTextData.emails[i])) {
            email = visibleTextData.emails[i];
            usedEmails.add(email);
          }
          if (!phone && visibleTextData.phones.length > i && !usedPhones.has(visibleTextData.phones[i])) {
            phone = visibleTextData.phones[i];
            usedPhones.add(phone);
          }
          
          if (name || email || phone) {
            finalContacts.push({
              role: role as "Primary" | "Billing" | "Reservations",
              name,
              email,
              phone,
            });
          }
        }
      }
      
      // If still no contacts, try from text field values
      if (finalContacts.length === 0 && textFieldValues.length > 0) {
        console.log(`[Zest Portal Scraper] Attempting to build contacts from text field values...`);
        
        // Group fields by their position - assume groups of 4 (firstName, lastName, email, phone)
        const fieldsWithValues = textFieldValues.filter(f => f.value || f.innerValue);
        if (fieldsWithValues.length > 0) {
          const roles = ['Primary', 'Billing', 'Reservations'];
          let roleIdx = 0;
          let currentContact: any = { role: roles[0] };
          
          for (const field of fieldsWithValues) {
            const val = field.innerValue || field.value;
            const label = field.label?.toLowerCase() || '';
            
            if (val && val.length > 0) {
              if (label.includes('first') || label.includes('name')) {
                if (currentContact.name) {
                  currentContact.name += ' ' + val;
                } else {
                  currentContact.name = val;
                }
              } else if (label.includes('last')) {
                currentContact.name = (currentContact.name || '') + ' ' + val;
              } else if (val.includes('@')) {
                currentContact.email = val;
              } else if (/^\+?[\d\s()-]{9,}$/.test(val)) {
                currentContact.phone = val;
              }
            }
          }
          
          if (currentContact.name || currentContact.email || currentContact.phone) {
            finalContacts.push(currentContact);
          }
        }
      }
      
      // Debug output
      if (finalContacts.length === 0) {
        console.log("[Zest Portal Scraper] No contacts extracted. Debug info:");
        console.log("[Zest Portal Scraper] Text fields with values:", textFieldValues.filter(f => f.value || f.innerValue));
        console.log("[Zest Portal Scraper] Sample page text:", visibleTextData.sampleText.substring(0, 1500));
      } else {
        console.log(`[Zest Portal Scraper] Successfully extracted ${finalContacts.length} contacts:`, finalContacts);
      }

      return {
        success: true,
        facilityId,
        facilityName: scrapedData.facilityName || undefined,
        contacts: finalContacts,
      };

    } catch (error) {
      console.error(`[Zest Portal Scraper] Error scraping facility ${facilityId}:`, error);
      if (this.page) {
        try {
          await this.page.screenshot({ path: `/tmp/zest-facility-${facilityId}-error.png`, fullPage: true });
        } catch {}
      }
      return {
        success: false,
        facilityId,
        contacts: [],
        error: String(error),
      };
    }
  }

  async scrapeFacilityContactsWithLogin(facilityId: number): Promise<ZestContactScrapeResult> {
    try {
      await this.initialize();
      
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        await this.close();
        return {
          success: false,
          facilityId,
          contacts: [],
          error: "Failed to log into Zest Golf portal",
        };
      }

      const result = await this.scrapeFacilityContacts(facilityId);
      
      await this.close();
      return result;
    } catch (error) {
      await this.close();
      return {
        success: false,
        facilityId,
        contacts: [],
        error: String(error),
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

export interface ZestCommissionRate {
  courseName: string;
  commissionPercent: number | null;
  greenFeeRate: string | null;
  buggyRate: string | null;
  otherRates: string | null;
}

export interface ZestScrapedContact {
  role: "Primary" | "Billing" | "Reservations";
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface ZestContactScrapeResult {
  success: boolean;
  facilityId: number;
  facilityName?: string;
  contacts: ZestScrapedContact[];
  error?: string;
}

let automationInstance: ZestGolfAutomation | null = null;

export function getZestGolfAutomation(): ZestGolfAutomation {
  if (!automationInstance) {
    automationInstance = new ZestGolfAutomation();
  }
  return automationInstance;
}
