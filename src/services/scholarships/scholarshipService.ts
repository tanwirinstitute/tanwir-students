import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { EmailService } from '../email/emailService';

export interface ScholarshipApplication {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  employment: string;
  course: string;
  form: string;
  interest: string;
  need: string;
  reason: string;
  zakat: string;
  status?: 'pending' | 'approved' | 'denied';
  reviewedBy?: string;
  reviewDate?: Date;
  submittedAt?: any; // Firestore Timestamp
  comments?: string;
  consented?: boolean;
  consentedAt?: any; // Firestore Timestamp
  consentEmailSentAt?: any; // Firestore Timestamp
}

export class ScholarshipService {
  private static instance: ScholarshipService;
  private db = getFirestore();
  private emailService: EmailService;

  private constructor() {
    this.emailService = EmailService.getInstance();
  }

  static getInstance(): ScholarshipService {
    if (!ScholarshipService.instance) {
      ScholarshipService.instance = new ScholarshipService();
    }
    return ScholarshipService.instance;
  }

  async getAllApplications(): Promise<ScholarshipApplication[]> {
    try {
      const applicationsRef = collection(this.db, 'scholarships');
      const snapshot = await getDocs(applicationsRef);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ScholarshipApplication));
    } catch (error) {
      console.error('Error fetching scholarship applications:', error);
      throw error;
    }
  }

  async getApplicationById(id: string): Promise<ScholarshipApplication | null> {
    try {
      const docRef = doc(this.db, 'scholarships', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ScholarshipApplication;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching scholarship application ${id}:`, error);
      throw error;
    }
  }

  async updateApplicationStatus(
    id: string, 
    status: 'approved' | 'denied', 
    reviewerUid: string,
    comments?: string,
    selectedNeed?: string
  ): Promise<void> {
    try {
      const docRef = doc(this.db, 'scholarships', id);
      
      // First, get the current application data to have access to email and name
      const application = await this.getApplicationById(id);
      if (!application) {
        throw new Error(`Application with ID ${id} not found`);
      }
      
      // Use the selectedNeed if provided, otherwise use the existing need
      const finalNeed = selectedNeed || application.need;
      
      // For approvals, check for discount code availability before updating status
      if (status === 'approved') {
        // Instead of calling checkCanSendApprovalEmail, we'll just get the recipient
        // and prepare for sending the email after the status update
        const recipient = {
          email: application.email,
          name: `${application.firstName} ${application.lastName}`
        };
        
        try {
          // Test if we can send the email (this will throw if no codes available)
          // Pass the need information to help select the appropriate discount code
          await this.emailService.sendScholarshipDecisionEmail(
            recipient,
            true,
            application.course,
            comments,
            finalNeed // Pass the selected need information
          );
        } catch (error) {
          // Re-throw the error to prevent status update
          throw error;
        }
      }
      
      // Update the application status in Firestore
      await updateDoc(docRef, {
        status,
        reviewedBy: reviewerUid,
        reviewDate: new Date(),
        comments: comments || '',
        need: finalNeed // Update the need field with the selected value
      });
      
      // Send email notification for denials only (approvals already sent)
      if (status === 'denied') {
        // For denial emails, we still catch errors since they're not critical
        try {
          await this.sendDecisionEmail(application, status, comments);
        } catch (emailError) {
          console.error('Failed to send denial email:', emailError);
        }
      }
    } catch (error) {
      console.error(`Error updating scholarship application ${id}:`, error);
      throw error;
    }
  }

  /**
   * Backfill (or correct) the submission date on an application. Used by the
   * admin utility for records that came in without a `submittedAt` and would
   * otherwise never show up under the "Active" filter.
   */
  async setSubmittedDate(id: string, date: Date): Promise<void> {
    try {
      const docRef = doc(this.db, 'scholarships', id);
      await updateDoc(docRef, { submittedAt: date });
    } catch (error) {
      console.error(`Error setting submitted date for application ${id}:`, error);
      throw error;
    }
  }

  async deleteApplication(id: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'scholarships', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting scholarship application ${id}:`, error);
      throw error;
    }
  }
  
  private async sendDecisionEmail(
    application: ScholarshipApplication,
    status: 'approved' | 'denied',
    comments?: string
  ): Promise<boolean> {
    const recipient = {
      email: application.email,
      name: `${application.firstName} ${application.lastName}`
    };
    
    const isApproved = status === 'approved';
    
    return this.emailService.sendScholarshipDecisionEmail(
      recipient,
      isApproved,
      application.course,
      comments,
      isApproved ? application.need : undefined // Pass need only for approvals
    );
  }
}
