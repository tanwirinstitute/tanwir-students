import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

export interface ProgramParticipant {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  attendeeCount: number;
}

export interface ProgramRegistration {
  id?: string;
  createdAt: Date;
  createdOn: string;
  customizations: {
    Email: string;
    'How Many Attending?': string;
    Name: string;
    Phone: string;
  };
  lastSynced: Date;
  metadata: {
    lastUpdated: string;
    orderId: string;
  };
  orderInfo: {
    billingAddress: {
      address1: string;
      address2: string | null;
      city: string;
      countryCode: string;
      firstName: string;
      lastName: string;
      phone: string;
      postalCode: string;
      state: string;
    };
    customerEmail: string;
    fulfillmentStatus: string;
    grandTotal: {
      currency: string;
      value: string;
    };
    orderNumber: string;
  };
  participantInfo: {
    attendeeCount: number;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  programDetails: {
    imageUrl: string;
    productId: string;
    sku: string;
    status: string;
  };
  programId: string;
  programName: string;
  programType: string;
}

export interface ProgramStats {
  programName: string;
  programType: string;
  totalRegistrations: number;
  totalAttendees: number;
  participants: ProgramParticipant[];
  imageUrl?: string;
  status: string;
}

export class ProgramService {
  private static instance: ProgramService;
  private db = getFirestore();

  private constructor() {}

  static getInstance(): ProgramService {
    if (!ProgramService.instance) {
      ProgramService.instance = new ProgramService();
    }
    return ProgramService.instance;
  }

  async getAllPrograms(): Promise<ProgramRegistration[]> {
    try {
      const programsRef = collection(this.db, 'programs');
      const q = query(programsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastSynced: data.lastSynced?.toDate() || new Date(),
        } as ProgramRegistration;
      });
    } catch (error) {
      console.error('Error fetching programs:', error);
      throw error;
    }
  }

  async getProgramStats(): Promise<ProgramStats[]> {
    try {
      const programs = await this.getAllPrograms();
      
      // Group programs by programName
      const programMap = new Map<string, ProgramRegistration[]>();
      
      programs.forEach(program => {
        const name = program.programName;
        if (!programMap.has(name)) {
          programMap.set(name, []);
        }
        programMap.get(name)!.push(program);
      });
      
      // Calculate stats for each program
      const stats: ProgramStats[] = [];
      
      programMap.forEach((registrations, programName) => {
        const totalRegistrations = registrations.length;
        const totalAttendees = registrations.reduce(
          (sum, reg) => sum + (reg.participantInfo?.attendeeCount || 0),
          0
        );
        
        const participants: ProgramParticipant[] = registrations.map(reg => ({
          firstName: reg.participantInfo?.firstName || '',
          lastName: reg.participantInfo?.lastName || '',
          email: reg.participantInfo?.email || '',
          phone: reg.participantInfo?.phone || '',
          attendeeCount: reg.participantInfo?.attendeeCount || 0,
        }));
        
        // Get program type and image from first registration
        const firstReg = registrations[0];
        
        stats.push({
          programName,
          programType: firstReg.programType || 'Unknown',
          totalRegistrations,
          totalAttendees,
          participants,
          imageUrl: firstReg.programDetails?.imageUrl,
          status: firstReg.programDetails?.status || 'registered',
        });
      });
      
      return stats;
    } catch (error) {
      console.error('Error calculating program stats:', error);
      throw error;
    }
  }
}
