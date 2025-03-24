import { RequestHandler } from 'express';
import { AuthenticatedRequest } from '../../types/express';
import { SERVER_CONFIG } from '../../config/serverConfig';
import { BadRequestError } from '../../errors/Bad-Request-Error';
import { AuthError } from '../../errors/Auth-Error';
import { NotFoundError } from '../../errors/Not-Found-Error';
import { auth, db } from '../../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { generateJWT } from '../../utils/jwt';

const TAP_COORDINATORS_COLLECTION = 'tap_coordinators';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      throw new BadRequestError('Name, email, and password are required');
    }

    // Check if coordinator already exists in Firestore
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where('regEmail', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new BadRequestError('Coordinator with this email already exists');
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);

    // Save coordinator data to Firestore
    const coordinatorData = {
      name,
      regEmail: email,
      role: 'tap',
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      id: userCredential.user.uid, // Use Firebase UID as ID
    };

    await setDoc(doc(db, TAP_COORDINATORS_COLLECTION, coordinatorData.id), coordinatorData);

    // Generate JWT
    const token = generateJWT({ id: coordinatorData.id, role: 'tap' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: SERVER_CONFIG.NODE_ENV === 'production',
      maxAge:  7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Coordinator registered successfully',
      data: { id: coordinatorData.id }
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email, password } = req.body;
    // console.log("reg_email and password are ",reg_email,password)
    if (!reg_email || !password) {
      throw new BadRequestError('reg_email and password are required');
    }

    // Find coordinator in Firestore
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where('regEmail', '==', reg_email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new NotFoundError('Coordinator not found');
    }

    const coordinatorDoc = querySnapshot.docs[0];
    const coordinator = { ...coordinatorDoc.data(), id: coordinatorDoc.id } as any;

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, reg_email, password);
    if (!userCredential.user.emailVerified) {
      throw new AuthError('Email not verified. Please verify your email.');
    }

    // Generate JWT
    const token = generateJWT({ id: coordinator.id, role: 'tap' });

    // Update last login
    await updateDoc(doc(db, TAP_COORDINATORS_COLLECTION, coordinator.id), {
      lastLogin: new Date(),
      updatedAt: new Date(),
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: SERVER_CONFIG.NODE_ENV === 'production',
      maxAge:  7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Coordinator login successful',
      data: { id: coordinator.id, role: 'tap' }
    });
  } catch (error: any) {
    if (error.code === 'auth/wrong-password') {
      next(new AuthError('Invalid password'));
    } else if (error.code === 'auth/user-not-found') {
      next(new NotFoundError('Coordinator not found in Firebase Auth'));
    } else {
      next(error);
    }
  }
};

export const logout: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || role !== 'tap') {
      throw new AuthError('Unauthorized: Only TAP coordinators can logout here');
    }

    await signOut(auth);
    res.clearCookie('token');
    res.status(200).json({
      success: true,
      message: 'Coordinator logout successful'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError('Email is required');
    }

    // Verify coordinator exists
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where('regEmail', '==', email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new NotFoundError('Coordinator not found');
    }

    // Use Firebase's built-in password reset email
    await sendPasswordResetEmail(auth, email);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully. Please check your inbox to reset your password.'
    });
  } catch (error) {
    next(error);
  }
};