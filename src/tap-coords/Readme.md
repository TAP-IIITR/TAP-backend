# 📘 API Documentation

## 🏫 Tap Co-Ordinator Role

### 🔐 Authentication Endpoints

#### 1️⃣ Login Tap Coordinator

**🛠 Endpoint:** `POST /auth/tap/login`\
**📌 Purpose:**\
Authenticate a Tap Coordinator into the student system.

### 📥 Input Parameters

| Field      | Type   | Required | Description      |
| ---------- | ------ | -------- | ---------------- |
| `email`    | String | ✅ Yes    | Registered email |
| `password` | String | ✅ Yes    | Password         |

### 🔄 Process

1. Validate the request body.
2. Check if the Tap Coordinator exists.
3. Verify the given password.
4. Generate JWT (payload: `{id, role: tap}`) and set Cookie.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Tap Coordinator successfully logged in.

### ❌ Error Responses

| Status Code | Description                                             |
| ----------- | ------------------------------------------------------- |
| `400`       | Invalid input parameters.                               |
| `404`       | Coordinator email does not exist or incorrect password. |
| `500`       | Internal server error.                                  |

---

#### 2️⃣ Logout Tap Coordinator

**🛠 Endpoint:** `POST /auth/tap/logout`\
**📌 Purpose:**\
Logs out the Tap Coordinator and clears authentication cookies.

### 📥 Input Parameters

No input parameters required.

### 🔄 Process

1. Clear JWT cookie.
2. Invalidate the session.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Successfully logged out.

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `401`       | Not logged in.         |
| `500`       | Internal server error. |

---

#### 3️⃣ Reset Password

**🛠 Endpoint:** `POST /auth/tap/reset-password`\
**📌 Purpose:**\
Reset Tap Coordinator's password through email OTP verification.

### 📥 Input Parameters

**Step 1 - Request OTP:**

| Field   | Type   | Required | Description      |
| ------- | ------ | -------- | ---------------- |
| `email` | String | ✅ Yes    | Registered email |

**Step 2 - Verify OTP & Reset Password:**

| Field          | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `email`        | String | ✅ Yes    | Registered email       |
| `otp`          | String | ✅ Yes    | OTP received via email |
| `new_password` | String | ✅ Yes    | New password           |

### 🔄 Process

1. Validate the request body.
2. Check if the coordinator exists.
3. Generate and send OTP to registered email.
4. Verify OTP and update password.

### 📤 Output

✅ **Success Response:**

**Step 1:**

- **Status Code:** `200 OK`
- **Message:** OTP sent successfully to registered email.

**Step 2:**

- **Status Code:** `200 OK`
- **Message:** Password successfully reset.

### ❌ Error Responses

| Status Code | Description               |
| ----------- | ------------------------- |
| `400`       | Invalid input parameters. |
| `404`       | Coordinator not found.    |
| `401`       | Invalid or expired OTP.   |
| `500`       | Internal server error.    |

---

### 🏠 Dashboard Endpoints

#### 1️⃣ Get Dashboard Data

**🛠 Endpoint:** `GET /dashboard/tap`

**📌 Purpose:**\
Retrieve all necessary information for the dashboard.

### 📥 Input Parameters

No input parameters required.

### 🔄 Process

1. Extract coordinator ID from JWT (handled via middleware).
2. Retrieve Tap Coordinator details from the database.
3. Return the required information.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Tap Coordinator info sent.
- **Data:**

```json
{
    "status": 200,
    "message": "Tap Coordinator Info sent",
    "coordinator": {
        "name": "Jaddu Singh",
        "email": "jaadu23@mail.com",
        "contact": "9857463158"
    }
}
```

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `500`       | Internal server error. |

---

<!-- #### 2️⃣ Update Dashboard

**🛠 Endpoint:** `PUT /dashboard/tap`

**📌 Purpose:**\
Update Tap Coordinator information.

### 📥 Input Parameters

| Field      | Type   | Required | Description               |
| ---------- | ------ | -------- | ------------------------- |
| `email?`   | String | ❌ No     | Coordinator working email |
| `contact?` | String | ❌ No     | Coordinator working phone |

### 🔄 Process

1. Validate the request body.
2. Extract Tap Coordinator ID from JWT (middleware).
3. Update details in the database.
4. Return response.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Details updated successfully.
 -->
---

### 📝 Job Management Endpoints

#### 1️⃣ Create Job

**🛠 Endpoint:** `POST /job/tap`

**📌 Purpose:**\
Create a new job listing.

### 📥 Input Parameters

| Field         | Type     | Required | Description                |
| ------------- | -------- | -------- | -------------------------- |
| `title`       | String   | ✅ Yes    | Job title                  |
| `JD`          | String   | ✅ Yes    | Job description            |
| `location`    | String   | ✅ Yes    | Job location               |
| `package`     | String   | ✅ Yes    | Salary package             |
| `eligibility` | String   | ✅ Yes    | Eligibility criteria       |
| `skills`      | String[] | ✅ Yes    | Required skills            |
| `deadline`    | Date     | ✅ Yes    | Application deadline       |
| `form`        | JSON     | ✅ Yes    | Application form structure |
| `recruiter`   | UUID     | ✅ Yes    | Recruiter ID               |

### 📤 Output

```json
{
    "status": 201,
    "message": "Job successfully created"
}
```

✅ **Success Response:**

- **Status Code:** `201 Created`
- **Message:** Job successfully created.

#### 2️⃣ Read Jobs

**🛠 Endpoint:** `GET /jobs/tap`  
**📌 Purpose:**  
Fetch all jobs or specific job details.

##### Get All Jobs

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Jobs fetched successfully",
    "data": {
        "jobs": [{
            "id": "uuid-here",
            "title": "Software Engineer",
            "location": "Bangalore",
            "package": "12-15 LPA",
            "deadline": "2025-03-01T00:00:00Z"
        }],
        "totalPages": 5,
        "currentPage": 1
    }
}
```

##### Get Job by ID
**🛠 Endpoint:** `GET /jobs/tap/:id`

### 📥 Input Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id`  | UUID | ✅ Yes    | Job ID      |

### 📤 Output
✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Job details fetched successfully",
    "data": {
        "id": "uuid-here",
        "title": "Software Engineer",
        "JD": "Detailed job description",
        "location": "Bangalore",
        "package": "12-15 LPA",
        "eligibility": "B.Tech/BE in CSE",
        "skills": ["JavaScript", "Node.js"],
        "deadline": "2025-03-01T00:00:00Z"
    }
}
```

#### 3️⃣ Update Job

**🛠 Endpoint:** `PUT /jobs/tap/:id`  
**📌 Purpose:**  
Update existing job details.

### 📥 Input Parameters
| Field         | Type     | Required | Description          |
|--------------|----------|----------|---------------------|
| `id`         | UUID     | ✅ Yes    | Job ID              |
| `title`      | String   | ❌ No     | Updated job title   |
| `JD`         | String   | ❌ No     | Job description     |
| `location`   | String   | ❌ No     | Job location        |
| `package`    | String   | ❌ No     | Salary package      |
| `eligibility`| String   | ❌ No     | Eligibility criteria|
| `skills`     | String[] | ❌ No     | Required skills     |
| `deadline`   | Date     | ❌ No     | Application deadline|

### 📤 Output
✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Job updated successfully"
}
```

#### 4️⃣ Delete Job

**🛠 Endpoint:** `DELETE /jobs/tap/:id`  
**📌 Purpose:**  
Remove a job listing from the system.

### 📥 Input Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id`  | UUID | ✅ Yes    | Job ID      |

### 📤 Output
✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Job deleted successfully"
}
```

### ❌ Common Error Responses

| Status Code | Description                                      |
|------------|--------------------------------------------------|
| `400`      | Invalid input parameters or validation failed     |
| `401`      | Unauthorized - Invalid or missing authentication  |            |
| `404`      | Job not found                                    |
| `500`      | Internal server error                            |


### 🏠 Recruiter Endpoints

#### 1️⃣ Get Recruiters

**🛠 Endpoint:** `GET /recruiters/tap`

**📌 Purpose:**\
Retrieve all recruiters.

### 📥 Input Parameters

No input parameters required.

### 🔄 Process

1. Extract all recruiters from the database.
2. Sort the results by isVerified(false first).
3. Return the required information.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Recruiters sent.
- **Data:**

```json
{
    "status": 200,
    "message": "Recruiter Info sent",
    "Recruiters": [
        {
            "company_name": "Apple",
            "POC": "Jaddu Singh",
            "email": "jaadu23@mail.com",
            "contact": "9857463158",
            "isVerified": false,
            "linkedin": "https://www.linkedin.com/in/apple",
            "website": "https://www.apple.com",
            "id": "uuid-here"
        }
    ]
}
```

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `500`       | Internal server error. |

#### 2️⃣ Get Recruiter

**🛠 Endpoint:** `GET /recruiters/tap/:id`

**📌 Purpose:**\
Retrieve a specific recruiter.

### 📥 Input Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id`  | UUID | ✅ Yes    | Recruiter ID|

### 🔄 Process

1. Extract recruiter's info from the database.
2. Return the required information.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Recruiter sent.
- **Data:**

```json
{
    "status": 200,
    "message": "Recruiter Info sent",
    "Recruiter":{
            "company_name": "Apple",
            "POC": "Jaddu Singh",
            "email": "jaadu23@mail.com",
            "contact": "9857463158",
            "isVerified": false,
            "linkedin": "https://www.linkedin.com/in/apple",
            "website": "https://www.apple.com",
            "id": "uuid-here"
        }
}
```

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `500`       | Internal server error. |


#### 3️⃣ Verify Recruiters

**🛠 Endpoint:** `PUT /recruiters/tap/:id`

**📌 Purpose:**\
Verify recruiter.

### 📥 Input Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id`  | UUID | ✅ Yes    | Recruiter ID|

### 🔄 Process

1. Extract recruiter from the database.
2. Update the isVerified field.
3. Return the required information.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** Recruiter Verified.
- **Data:**

```json
{
    "status": 200,
    "message": "Recruiter verified",
    "Recruiters":
        {
            "company_name": "Apple",
            "POC": "Jaddu Singh",
            "email": "jaadu23@mail.com",
            "contact": "9857463158",
            "isVerified": true,
            "linkedin": "https://www.linkedin.com/in/apple",
            "website": "https://www.apple.com",
            "id": "uuid-here"
        }
}
```

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `500`       | Internal server error. |

---

### 🏠 CGPA Endpoints

#### 1️⃣ Update CGPA

**🛠 Endpoint:** `POST /cgpa/tap`

**📌 Purpose:**\
Update CGPA of students.

### 📥 Input Parameters

| Field   | Type   | Required | Description |
| ------- | ------ | -------- | ----------- |
| `cgpa`  | File | ✅ Yes    | An excel sheet        |

### 🔄 Process

1. Extract Reg No. and CGPA of every student.
2. Update result in DB.
3. Return the required information.

### 📤 Output

✅ **Success Response:**

- **Status Code:** `200 OK`
- **Message:** CGPA Updated.
- **Data:**

```json
{
    "status": 200,
    "message": "CGPA updated"
}
```

### ❌ Error Responses

| Status Code | Description            |
| ----------- | ---------------------- |
| `500`       | Internal server error. |

### 👥 Student Management Endpoints

#### 1️⃣ Get All Students

**🛠 Endpoint:** `GET /students/tap`  
**📌 Purpose:**  
Retrieve a list of all students with basic information.

### 📥 Input Parameters

Optional query parameters for filtering:
| Field       | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| `branch`   | String | ❌ No     | Filter by branch               |
| `batch`    | Number | ❌ No     | Filter by graduation year      |
| `page`     | Number | ❌ No     | Page number (default: 1)       |
| `limit`    | Number | ❌ No     | Items per page (default: 10)   |

### 📤 Output

✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Students fetched successfully",
    "data": {
        "students": [{
            "id": "uuid-here",
            "name": "John Doe",
            "regNo": "20BCE1234",
            "branch": "CSE",
            "batch": 2024,
            "cgpa": 8.5
        }],
        "totalPages": 5,
        "currentPage": 1
    }
}
```

#### 2️⃣ Get Student Details

**🛠 Endpoint:** `GET /students/tap/:id`  
**📌 Purpose:**  
Retrieve detailed information about a specific student.

### 📥 Input Parameters
| Field | Type | Required | Description  |
|-------|------|----------|--------------|
| `id`  | UUID | ✅ Yes    | Student ID   |

### 📤 Output
✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Student details fetched successfully",
    "data": {
        "id": "uuid-here",
        "name": "John Doe",
        "regNo": "20BCE1234",
        "email": "john.doe@example.com",
        "branch": "CSE",
        "batch": 2024,
        "cgpa": 8.5,
        "contact": "9876543210",
        "resume": "resume-url-here"
    }
}
```

#### 3️⃣ Get Student Job Applications

**🛠 Endpoint:** `GET /students/tap/:id/applications`  
**📌 Purpose:**  
Retrieve all job applications submitted by a specific student.

### 📥 Input Parameters
| Field | Type | Required | Description  |
|-------|------|----------|--------------|
| `id`  | UUID | ✅ Yes    | Student ID   |

### 📤 Output
✅ **Success Response:**
- **Status Code:** `200 OK`
```json
{
    "status": 200,
    "message": "Applications fetched successfully",
    "data": {
        "applications": [{
            "jobId": "uuid-here",
            "companyName": "Example Corp",
            "jobTitle": "Software Engineer",
            "appliedAt": "2025-02-09T10:00:00Z",
            "status": "PENDING",
            "package": "12-15 LPA"
        }],
        "totalApplications": 5
    }
}
```

### ❌ Common Error Responses

| Status Code | Description                                     |
|------------|-------------------------------------------------|
| `400`      | Invalid input parameters                        |
| `401`      | Unauthorized - Invalid or missing authentication |
| `404`      | Student not found                               |
| `500`      | Internal server error                           |