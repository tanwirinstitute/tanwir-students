import axios from 'axios';

export interface EmailRecipient {
  email: string;
  name?: string;
}

const VALID_DISCOUNTS = [25, 50, 75, 100];

/**
 * Resolve an application's `need` value to a discount percentage the approval
 * relay accepts (25 / 50 / 75 / 100). Handles a direct percentage ("75%") as
 * well as the older free-text levels ("moderate", "significant", ...).
 */
function needToDiscountPercentage(need: string | undefined): number {
  if (!need) return 25;

  const needLower = need.toLowerCase();

  const percentageMatch = needLower.match(/(\d+)\s*%/);
  if (percentageMatch) {
    const percentage = parseInt(percentageMatch[1], 10);
    if (VALID_DISCOUNTS.includes(percentage)) return percentage;
  }

  if (/(extreme|severe|high|full)/.test(needLower)) return 100;
  if (/(significant|major|substantial)/.test(needLower)) return 75;
  if (/(moderate|partial|some)/.test(needLower)) return 50;
  return 25;
}

export interface EmailOptions {
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender?: EmailRecipient;
  recipients: EmailRecipient[];
  replyTo?: EmailRecipient;
}

export class EmailService {
  private static instance: EmailService;
  private backendUrl: string;
  private apiKey: string;

  private constructor() {
    const envBackendUrl = import.meta.env.VITE_TANWIR_EMAILER;
    this.backendUrl = envBackendUrl || 'http://localhost:3000';
    this.apiKey = import.meta.env.VITE_TANWIR_EMAILER_API || '';

    console.log('📧 EmailService initialized:');
    console.log('- Using backend URL:', this.backendUrl);
    console.log('- API key set:', this.apiKey ? 'yes' : 'no');
  }

  private get authHeaders() {
    return this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {};
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Test function to check if the backend is reachable
  async testBackendConnection(): Promise<boolean> {
    try {
      console.log(`🔍 Testing connection to backend at ${this.backendUrl}/health`);
      
      // Try to call the health endpoint
      const response = await axios.get(`${this.backendUrl}/health`, {
        timeout: 5000,
        headers: this.authHeaders
      });
      
      console.log(`✅ Backend health check response: ${response.status} ${response.statusText}`, response.data);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Backend connection test failed:', {
          message: error.message,
          code: error.code,
          response: error.response?.data || 'No response data'
        });
        
        // Check for common issues
        if (error.code === 'ECONNREFUSED') {
          console.error('⚠️ Connection refused. Make sure your backend server is running.');
        } else if (error.message.includes('Network Error')) {
          console.error('⚠️ Network error. This might be a CORS issue or the server is not running.');
        } else if (error.response?.status === 404) {
          console.error('⚠️ Health endpoint not found. Make sure your backend has a /health endpoint.');
        }
      } else {
        console.error('❌ Unknown error testing backend connection:', error);
      }
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      console.log('📤 Attempting to send email via backend:', {
        subject: options.subject,
        to: options.recipients
      });
      
      if (!this.backendUrl) {
        console.error('❌ Cannot send email: Backend URL is not set');
        return false;
      }

      // We're not using this generic method for now, as we're specifically
      // calling the financial aid endpoint. This could be expanded later.
      console.warn('⚠️ Generic sendEmail method is not implemented with the backend API');
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios error sending email:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
      } else {
        console.error('❌ Error sending email:', error);
      }
      return false;
    }
  }

  /**
   * Approve a scholarship application: create a discount code and email it to
   * the applicant.
   *
   * The browser must never hold the discount / emailer secrets, so this posts
   * to the same-origin relay (`/api/approve-financial-aid` — the Netlify
   * function in prod, the vite dev middleware locally) which creates the code
   * in real time and forwards it to the emailer.
   *
   * @throws Error with a user-facing message if the approval could not be completed.
   */
  async sendScholarshipDecisionEmail(
    recipient: EmailRecipient,
    approved: boolean,
    courseName: string,
    comments?: string,
    need?: string
  ): Promise<boolean> {
    if (!approved) {
      console.log('📧 Denial emails are not currently implemented in the backend API');
      return false;
    }

    const discountPercentage = needToDiscountPercentage(need);
    console.log(
      `📧 Approving financial aid for ${recipient.email} — ${courseName} @ ${discountPercentage}% (need: "${need ?? ''}")`
    );

    try {
      const response = await axios.post('/api/approve-financial-aid', {
        course: courseName,
        discountPercentage,
        recipientEmail: recipient.email,
        studentName: recipient.name || 'Student',
        comments: comments || undefined,
      });

      if (response.data?.success) {
        console.log(
          `✅ Financial aid approved — discount code ${response.data.code} emailed to ${recipient.email}`
        );
        return true;
      }

      throw new Error(response.data?.message || 'Financial aid approval failed.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string } | undefined)?.message || error.message;
        console.error('❌ Financial aid approval failed:', message);
        throw new Error(message);
      }
      console.error('❌ Financial aid approval failed:', error);
      throw error;
    }
  }

  /**
   * Send welcome emails to multiple students for Prophetic Guidance course
   * @param emails Array of student email addresses
   * @returns Promise resolving to boolean indicating success
   */
  async sendPropheticGuidanceWelcomeEmails(emails: string[]): Promise<boolean> {
    console.log(`📧 Preparing welcome emails for ${emails.length} students via backend API`);
    console.log(`- Backend URL: ${this.backendUrl}`);
    
    try {
      // First test the connection
      const isConnected = await this.testBackendConnection();
      if (!isConnected) {
        console.error('❌ Cannot send emails: Backend connection test failed');
        throw new Error('Backend connection test failed');
      }
      
      // Construct the full URL
      const fullUrl = `${this.backendUrl}/send-prophetic-guidance-welcome`;
      console.log(`- Full API URL: ${fullUrl}`);
      
      // Prepare payload with the email addresses
      const payload = {
        emails: emails
      };
      console.log(`- Sending welcome emails to ${emails.length} recipients`);
      
      const response = await axios.post(fullUrl, payload, { headers: this.authHeaders });

      console.log('- Response received:', response.status, response.statusText);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Welcome emails sent successfully via backend API');
        return true;
      } else {
        console.error('❌ Backend API returned an error:', response.data);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios error calling backend API:', {
          message: error.message,
          response: error.response?.data || 'No response data',
          status: error.response?.status || 'No status code'
        });
        
        // Check for CORS issues
        if (error.message.includes('Network Error') || !error.response) {
          console.error('⚠️ This might be a CORS issue. Make sure your backend has CORS enabled for your frontend origin.');
        }
      } else {
        console.error('❌ Error calling backend API:', error);
      }
      
      return false;
    }
  }

  /**
   * Send welcome emails to multiple students for Associates Program
   * @param recipients Array of recipients with email and name
   * @returns Promise resolving to boolean indicating success
   */
  async sendAssociatesProgramWelcomeEmails(recipients: EmailRecipient[]): Promise<boolean> {
    console.log(`📧 Preparing Associates Program welcome emails for ${recipients.length} students via backend API`);
    console.log(`- Backend URL: ${this.backendUrl}`);
    
    try {
      // First test the connection
      const isConnected = await this.testBackendConnection();
      if (!isConnected) {
        console.error('❌ Cannot send emails: Backend connection test failed');
        throw new Error('Backend connection test failed');
      }
      
      // Construct the full URL
      const fullUrl = `${this.backendUrl}/send-associates-program-welcome`;
      console.log(`- Full API URL: ${fullUrl}`);
      
      // Prepare payload with the recipients
      const payload = {
        recipients: recipients
      };
      console.log(`- Sending welcome emails to ${recipients.length} recipients`);
      
      const response = await axios.post(fullUrl, payload, { headers: this.authHeaders });

      console.log('- Response received:', response.status, response.statusText);

      if (response.status === 200 && response.data.success) {
        console.log('✅ Associates Program welcome emails sent successfully via backend API');
        return true;
      } else {
        console.error('❌ Backend API returned an error:', response.data);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios error calling backend API:', {
          message: error.message,
          response: error.response?.data || 'No response data',
          status: error.response?.status || 'No status code'
        });
        
        // Check for CORS issues
        if (error.message.includes('Network Error') || !error.response) {
          console.error('⚠️ This might be a CORS issue. Make sure your backend has CORS enabled for your frontend origin.');
        }
      } else {
        console.error('❌ Error calling backend API:', error);
      }
      
      return false;
    }
  }
}
