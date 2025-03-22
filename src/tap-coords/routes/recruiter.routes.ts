
    import { Router } from "express";
    import { param } from "express-validator";
    import { validateRequest } from "../../middleware/validation.middleware";
    import { deleteRecruiter, getAllRecruiters, getRecruiterById, verifyRecruiter } from "../controllers/recruiter.controllers";
import { checkTapAuth } from "../../middleware/tapauth.middleware";
    
    const router = Router();
    
    router.get("/", checkTapAuth, getAllRecruiters);
    
    router.get(
      "/:id",
      [
        param("id").isUUID().withMessage("Invalid UUID"),
      ],
      validateRequest,
      checkTapAuth,
      getRecruiterById
    );
    
    router.put(
      "/:id",
      [
        param("id").isUUID().withMessage("Invalid UUID"),
      ],
      validateRequest,
      checkTapAuth,
      verifyRecruiter
    );
    
    router.delete(
      "/:id",
      [
        param("id").isUUID().withMessage("Invalid UUID"),
      ],
      validateRequest,
      checkTapAuth,
      deleteRecruiter
    );
    

export { router as tapRecruiterRouter };
