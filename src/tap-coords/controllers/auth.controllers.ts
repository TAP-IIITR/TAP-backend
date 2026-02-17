import { RequestHandler } from "express";
import { AuthenticatedRequest } from "../../types/express";
import { SERVER_CONFIG } from "../../config/serverConfig";
import { BadRequestError } from "../../errors/Bad-Request-Error";
import { AuthError } from "../../errors/Auth-Error";
import { NotFoundError } from "../../errors/Not-Found-Error";
import logger from "../../utils/logger";
import { auth, db } from "../../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { generateJWT } from "../../utils/jwt";

const TAP_COORDINATORS_COLLECTION = "tap_coordinators";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      throw new BadRequestError("Name, email, and password are required");
    }

    // Check if coordinator already exists in Firestore
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where("regEmail", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new BadRequestError("Coordinator with this email already exists");
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await sendEmailVerification(userCredential.user);

    // Save coordinator data to Firestore
    const coordinatorData = {
      name,
      regEmail: email,
      role: req.body.role || "tap",
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      id: userCredential.user.uid, // Use Firebase UID as ID
    };

    await setDoc(
      doc(db, TAP_COORDINATORS_COLLECTION, coordinatorData.id),
      coordinatorData
    );

    // Generate JWT
    const token = generateJWT({ id: coordinatorData.id, role: coordinatorData.role });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: "Coordinator registered successfully",
      data: { id: coordinatorData.id },
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { reg_email, password } = req.body;
    if (!reg_email || !password) {
      throw new BadRequestError("reg_email and password are required");
    }

    // Find coordinator in Firestore
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where("regEmail", "==", reg_email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new NotFoundError("Coordinator not found");
    }

    const coordinatorDoc = querySnapshot.docs[0];
    const coordinator = {
      ...coordinatorDoc.data(),
      id: coordinatorDoc.id,
    } as any;

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(
      auth,
      reg_email,
      password
    );
    if (!userCredential.user.emailVerified) {
      throw new AuthError("Email not verified. Please verify your email.");
    }

    // Generate JWT
    const token = generateJWT({ id: coordinator.id, role: coordinator.role });

    // Update last login
    await updateDoc(doc(db, TAP_COORDINATORS_COLLECTION, coordinator.id), {
      lastLogin: new Date(),
      updatedAt: new Date(),
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`TAP Coordinator login successful for ${reg_email}`);
    res.status(200).json({
      success: true,
      message: "Coordinator login successful",
      data: { id: coordinator.id, role: coordinator.role },
    });
  } catch (error: any) {
    logger.error("TAP Coordinator login failed", { error, email: req.body.reg_email });
    if (error.code === "auth/wrong-password") {
      next(new AuthError("Invalid password"));
    } else if (error.code === "auth/user-not-found") {
      next(new NotFoundError("Coordinator not found in Firebase Auth"));
    } else {
      next(error);
    }
  }
};

export const logout: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next
) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || (role !== "tap" && role !== "tpo")) {
      throw new AuthError(
        "Unauthorized: Only TAP coordinators or TPO can logout here"
      );
    }

    await signOut(auth);
    res.clearCookie("token");
    res.status(200).json({
      success: true,
      message: "Coordinator logout successful",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError("Email is required");
    }

    // Verify coordinator exists
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const q = query(tapRef, where("regEmail", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new NotFoundError("Coordinator not found");
    }

    // Use Firebase's built-in password reset email
    await sendPasswordResetEmail(auth, email);

    res.status(200).json({
      success: true,
      message:
        "Password reset email sent successfully. Please check your inbox to reset your password.",
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCoordinators: RequestHandler = async (req, res, next) => {
  try {
    const tapRef = collection(db, TAP_COORDINATORS_COLLECTION);
    const querySnapshot = await getDocs(tapRef);
    const coordinators = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    res.status(200).json({
      success: true,
      data: coordinators,
    });
  } catch (error) {
    next(error);
  }
};

import { adminAuth, adminDb } from "../../config/firebaseAdmin";

export const deleteCoordinator: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError("Coordinator ID is required");
    }

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(id);
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        logger.error("Error deleting user from Firebase Auth", { error, id });
      }
    }

    // Delete from Firestore
    await adminDb.collection(TAP_COORDINATORS_COLLECTION).doc(id).delete();

    logger.info(`Coordinator ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Coordinator deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

import * as XLSX from "xlsx";

export const getSampleCSV: RequestHandler = async (req, res, next) => {
  try {
    const data = [
      ["name", "email", "password"],
      ["John Doe", "john.doe@iiitranchi.ac.in", "tempPass123"],
      ["Jane Smith", "jane.smith@iiitranchi.ac.in", "tempPass456"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "csv" });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=coordinator_template.csv"
    );
    res.status(200).send(buf);
  } catch (error) {
    next(error);
  }
};

export const bulkRegister: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of data) {
      const { name, email, password } = row;

      if (!name || !email || !password) {
        results.failed++;
        results.errors.push(`Missing data for row: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        // Check if exists
        const userQuery = await adminAuth
          .getUserByEmail(email)
          .catch(() => null);
        if (userQuery) {
          results.failed++;
          results.errors.push(`User already exists: ${email}`);
          continue;
        }

        // Create in Auth
        const userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: name,
        });

        // Save to Firestore
        const coordinatorData = {
          name,
          regEmail: email,
          role: "tap",
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
          id: userRecord.uid,
        };

        await adminDb
          .collection(TAP_COORDINATORS_COLLECTION)
          .doc(userRecord.uid)
          .set(coordinatorData);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Error registering ${email}: ${error.message}`);
      }
    }

    logger.info(
      `Bulk registration complete. Success: ${results.success}, Failed: ${results.failed}`
    );
    res.status(200).json({
      success: true,
      message: `Bulk registration complete. ${results.success} successfully registered, ${results.failed} failed.`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};
