import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, Firestore, deleteDoc } from 'firebase/firestore';

export type UserRole = 'student' | 'admin';

export interface AuthorizedUser {
  uid: string;
  CreatedAt: Date;
  FirstName: string;
  LastName: string;
  Role: UserRole;
  email?: string;
  password?: string;
  courses?: { courseRef: string }[];
}

export class AuthService {
  private static instance: AuthService;
  private authStateListeners: ((user: User | null) => void)[] = [];
  private db: Firestore;

  private constructor() {
    this.db = getFirestore();
    onAuthStateChanged(auth, (user) => {
      this.authStateListeners.forEach(listener => listener(user));
    });
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async signInWithGoogle(): Promise<User | null> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      if (!user.email) {
        await this.signOut();
        throw new Error('Google account missing email.');
      }
  
      
      // First try by UID
      let existingUserDoc = await getDoc(doc(this.db, 'authorizedUsers', user.uid));

      let existingUser: { id: string; data: AuthorizedUser } | null = null;

      if (existingUserDoc.exists()) {
        existingUser = {
          id: existingUserDoc.id,
          data: existingUserDoc.data() as AuthorizedUser
        };
      } else {
        existingUser = await this.findUserByEmail(user.email);
      }

      if (!existingUser) {
        await this.signOut();
        throw new Error('Unauthorized user. Please contact an administrator.');
      }
  
      // Check if the user's Firebase Auth UID matches their document ID in authorizedUsers
      if (existingUser.id !== user.uid) {
        console.log('⚠️ User document ID does not match Firebase Auth UID. Updating...');
        
        try {
          // Copy the existing user data to a new document with the Firebase Auth UID
          await setDoc(doc(this.db, 'authorizedUsers', user.uid), {
            ...existingUser.data,
            uid: user.uid // Update the UID field to match Firebase Auth UID
          });
          
          // Delete the old document to match email/password authentication behavior
          await deleteDoc(doc(this.db, 'authorizedUsers', user.email));
          
          console.log('✅ Updated user document ID to match Firebase Auth UID');
        } catch (updateError) {
          console.error('Failed to update user document ID:', updateError);
          // Continue with sign-in even if the update fails
        }
      }
  
      // Check if current Firebase Auth user has a different sign-in method
      const methods = await fetchSignInMethodsForEmail(auth, user.email);
      if (methods.includes('password') && !methods.includes('google.com')) {
        // Already registered with email/password, try linking
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential) {
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              await linkWithCredential(currentUser, credential);
              console.log('🔗 Linked Google to existing email/password account');
            }
          } catch (linkError) {
            console.warn('Failed to link Google account:', linkError);
          }
        }
      }
  
      return user;
    } catch (error: any) {
      console.error('Google sign-in error:', error.message);
      throw error;
    }
  }
  
  

  async signInWithEmailPassword(email: string, password: string): Promise<User | null> {
    try {
      // First authenticate with Firebase
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
  
      console.log('✅ Email/password sign-in success:', {
        uid: user.uid,
        email: user.email
      });
  
      // Check if they are authorized in the current user document
      const userDoc = await getDoc(doc(this.db, 'authorizedUsers', user.uid));
      
      if (!userDoc.exists()) {
        // If not found by UID, try to find by email
        const existingUser = await this.findUserByEmail(user.email || '');
        
        if (!existingUser) {
          // No matching user found in authorizedUsers collection
          console.warn('❌ Not an authorized user. Signing out.');
          await this.signOut();
          throw new Error('Unauthorized user. Please contact an administrator.');
        }
        
        // Found user by email but with different UID, update the document
        console.log('⚠️ User document ID does not match Firebase Auth UID. Updating...');
        
        try {
          // Copy the existing user data to a new document with the Firebase Auth UID
          await setDoc(doc(this.db, 'authorizedUsers', user.uid), {
            ...existingUser.data,
            uid: user.uid // Update the UID field to match Firebase Auth UID
          });
          
          // Delete the old document (optional, may want to keep for reference)
          await deleteDoc(doc(this.db, 'authorizedUsers', existingUser.id));
          
          console.log('✅ Updated user document ID to match Firebase Auth UID');
        } catch (updateError) {
          console.error('Failed to update user document ID:', updateError);
          // Continue with sign-in even if the update fails
        }
      }
  
      return user;
    } catch (error: any) {
      console.error('Email/password sign-in failed:', error.message);
      throw error;
    }
  }
  
  

  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    return () => {
      this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
    };
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  async getUserData(userId: string): Promise<AuthorizedUser | null> {
    try {
      const userDoc = await getDoc(doc(this.db, 'authorizedUsers', userId));
      
      if (userDoc.exists()) {
        return userDoc.data() as AuthorizedUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      const usersRef = collection(this.db, 'authorizedUsers');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  async getUserIdByName(name: string): Promise<string | null> {
    try {
      const usersRef = collection(this.db, 'authorizedUsers');
      const querySnapshot = await getDocs(usersRef);
      
      const nameLower = name.toLowerCase();
      
      for (const doc of querySnapshot.docs) {
        const userData = doc.data();
        const firstName = (userData.FirstName || '').toLowerCase();
        const lastName = (userData.LastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        
        if (firstName.includes(nameLower) || 
            lastName.includes(nameLower) || 
            fullName.includes(nameLower)) {
          return doc.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user by name:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<AuthorizedUser[]> {
    const usersRef = collection(this.db, 'authorizedUsers');
    const querySnapshot = await getDocs(usersRef);
    const users = querySnapshot.docs.map(doc => ({
      ...doc.data() as AuthorizedUser,
      uid: doc.id  
    }));
    return users;
  }

  async createAuthorizedUser(user: User, role: UserRole = 'student'): Promise<void> {
    if (!user.uid || !user.email) throw new Error('User must have UID and email');

    const userData: AuthorizedUser = {
      uid: user.uid,
      CreatedAt: new Date(),
      FirstName: user.displayName?.split(' ')[0] || '',
      LastName: user.displayName?.split(' ')[1] || '',
      Role: role
    };

    try {
      await setDoc(doc(this.db, 'authorizedUsers', user.uid), userData);
      console.log('Authorized user created successfully with role:', role);
    } catch (error) {
      console.error('Error creating authorized user:', error);
      throw error;
    }
  }

  async getUserRole(): Promise<UserRole | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    
    const userData = await this.getUserData(user.uid);
    return userData?.Role || null;
  }

  async getUserEnrolledCourses(): Promise<string[]> {
    const user = this.getCurrentUser();
    if (!user) {
      console.log('getUserEnrolledCourses: No current user found');
      return [];
    }
    
    try {
      console.log('getUserEnrolledCourses: Fetching data for user', user.uid);
      
      // Direct Firestore query to check the exact structure
      const userDocRef = doc(this.db, 'authorizedUsers', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.log('getUserEnrolledCourses: User document does not exist');
        return [];
      }
      
      const userData = userDocSnap.data();
      console.log('getUserEnrolledCourses: Raw user data from Firestore:', JSON.stringify(userData));
      
      // Handle different possible structures
      let courseRefs: string[] = [];
      
      if (userData.courses) {
        console.log('getUserEnrolledCourses: Found courses array in user data');
        
        // Try to extract course references from the courses array
        courseRefs = userData.courses.map((course: any) => {
          console.log('Course item structure:', course);
          
          let courseRef: string | null = null;
          
          // Handle different possible structures
          if (typeof course === 'string') {
            // If the course is directly a string reference
            courseRef = course;
          } else if (course.courseRef) {
            // If the course has a courseRef property
            courseRef = course.courseRef;
          } else if (course.id) {
            // If the course has an id property
            courseRef = course.id;
          } else if (course.Id) {
            // If the course has an Id property
            courseRef = course.Id;
          } else {
            console.log('Unknown course reference structure:', course);
            return null;
          }
          
          // Extract just the document ID from the path if it contains a slash
          if (courseRef && courseRef.includes('/')) {
            const parts = courseRef.split('/');
            courseRef = parts[parts.length - 1];
            console.log(`Extracted document ID '${courseRef}' from path`);
          }
          
          return courseRef;
        }).filter(Boolean); // Remove any null values
      } else if (userData.courseRefs) {
        // Alternative: courses might be stored as courseRefs array
        console.log('getUserEnrolledCourses: Found courseRefs array in user data');
        courseRefs = userData.courseRefs.map((ref: string) => {
          if (ref.includes('/')) {
            const parts = ref.split('/');
            return parts[parts.length - 1];
          }
          return ref;
        });
      } else if (userData.enrolledCourses) {
        // Another alternative: might be stored as enrolledCourses
        console.log('getUserEnrolledCourses: Found enrolledCourses array in user data');
        courseRefs = userData.enrolledCourses.map((ref: string) => {
          if (ref.includes('/')) {
            const parts = ref.split('/');
            return parts[parts.length - 1];
          }
          return ref;
        });
      }
      
      console.log('getUserEnrolledCourses: Final course refs', courseRefs);
      return courseRefs;
    } catch (error) {
      console.error('Error fetching user enrolled courses:', error);
      return [];
    }
  }

  async findUserByEmail(email: string): Promise<{ id: string, data: AuthorizedUser } | null> {
    try {
      const usersRef = collection(this.db, 'authorizedUsers');
      
      // Check for documents with matching email field
      const emailQuery = query(usersRef, where('email', '==', email));
      let querySnapshot = await getDocs(emailQuery);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          data: doc.data() as AuthorizedUser
        };
      }
      
      // If not found by email field, check if any document ID matches the email
      try {
        const docRef = doc(this.db, 'authorizedUsers', email);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log('✅ Found user by document ID matching email');
          return {
            id: docSnap.id,
            data: docSnap.data() as AuthorizedUser
          };
        }
      } catch (docError) {
        console.warn('Error checking document by ID:', docError);
        // Continue to return null
      }
      
      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }
}
