import axios from 'axios';
import { DiscountCodeService } from '../discounts/discountCodeService';

export interface EmailRecipient {
  email: string;
  name?: string;
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
  private discountCodeService: DiscountCodeService;

  private constructor() {
    // Get the backend URL from environment variables
    const envBackendUrl = import.meta.env.VITE_TANWIR_EMAILER;
    this.backendUrl = envBackendUrl || 'http://localhost:3000';
    
    console.log('📧 EmailService initialized:');
    console.log('- Environment variable VITE_TANWIR_EMAILER:', envBackendUrl ? `"${envBackendUrl}"` : 'not set');
    console.log('- Using backend URL:', this.backendUrl);
    
    // Log all available environment variables (without values for security)
    console.log('- Available env variables:', Object.keys(import.meta.env).join(', '));
    
    // Initialize discount code service
    this.discountCodeService = DiscountCodeService.getInstance();
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
        timeout: 60000 // 60 second timeout to allow Render cold starts
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
   * Send a scholarship decision email
   * @throws Error with a user-friendly message if no discount codes are available
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
    
    console.log(`📧 Preparing approval email for ${recipient.email} via backend API`);
    console.log(`- Backend URL: ${this.backendUrl}`);
    
    try {
      // Get an available discount code for this course
      const discountCode = await this.discountCodeService.getAvailableCode(courseName, need);
      
      if (!discountCode) {
        const errorMessage = 'No available discount codes found for this course. Please request more discount codes before approving additional applications.';
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      console.log(`✅ Found available discount code: ${discountCode.code} (${discountCode.discount})`);
      
      // Extract discount percentage from the string (e.g., "100%" -> 100)
      const discountPercentage = parseInt(discountCode.discount.replace('%', ''));
      
      // Construct the full URL
      const fullUrl = `${this.backendUrl}/send-financial-aid-email`;
      console.log(`- Full API URL: ${fullUrl}`);
      
      // Prepare payload with the new fields
      const payload = {
        recipientEmail: recipient.email,
        studentName: recipient.name || 'Student',
        discountPercentage: discountPercentage,
        discountCode: discountCode.code,
        programName: courseName,
        additionalDetails: comments || `This scholarship is for the ${courseName} course.`
      };
      console.log('- Payload:', JSON.stringify(payload));
      
      // Call the backend API to send the financial aid acceptance email
      console.log('- Sending POST request...');
      const response = await axios.post(fullUrl, payload);
      
      console.log('- Response received:', response.status, response.statusText);
      
      if (response.status === 200 && response.data.success) {
        console.log('✅ Financial aid email sent successfully via backend API');
        
        // Mark the discount code as used
        if (discountCode.id) {
          await this.discountCodeService.markCodeAsUsed(discountCode.id, recipient.email);
        }
        
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
          console.error('⚠️ Try adding this to your Express app:');
          console.error(`
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] // Add your frontend URL
}));
          `);
        }
      } else {
        console.error('❌ Error calling backend API:', error);
      }
      
      // Re-throw the error to be handled by the caller
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
      // Construct the full URL
      const fullUrl = `${this.backendUrl}/send-prophetic-guidance-welcome`;
      console.log(`- Full API URL: ${fullUrl}`);
      
      // Prepare payload with the email addresses
      const payload = {
        emails: emails
      };
      console.log(`- Sending welcome emails to ${emails.length} recipients`);
      
      // Call the backend API to send the welcome emails
      const response = await axios.post(fullUrl, payload);
      
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
      // Construct the full URL
      const fullUrl = `${this.backendUrl}/send-associates-program-welcome`;
      console.log(`- Full API URL: ${fullUrl}`);
      
      // Prepare payload with the recipients
      const payload = {
        recipients: recipients
      };
      console.log(`- Sending welcome emails to ${recipients.length} recipients`);
      
      // Call the backend API to send the welcome emails
      const response = await axios.post(fullUrl, payload);
      
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
