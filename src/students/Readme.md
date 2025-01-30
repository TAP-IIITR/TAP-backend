# 📘 API Documentation  
## 🏫 Student Role  

### 🔐 Authentication Endpoints  

#### 1️⃣ Register Student  
**🛠 Endpoint:** `POST /auth/student/register`  

**📌 Purpose:**  
Registers a student with the necessary information.  

### 📥 Input Parameters  

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `first_name`     | String | ✅ Yes    | Student's first name. |
| `last_name`     | String | ✅ Yes    | Student's last name. |
| `reg_email`    | String | ✅ Yes    | Registered email for login. |
| `mobile`   | String | ✅ Yes    | Contact number. |
| `linkedin` | String | ✅ Yes     | LinkedIn profile URL. |
| `password` | String | ✅ Yes    | Password (encrypted by Firebase). |

### 🔄 Process  
1. Validate the request body.  
2. Check if the student already exists.  
3. Save the student data to Firebase (password encrypted by Firebase).  
4. Send OTP to the registered email.  
5. Generate JWT(payload: {id, role: student}) and set Cookie.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `201 Created`  
- **Message:** Student successfully saved to Firebase DB.  

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `404 Bad Request Error`            | Student already exists.           |
| `500 Internal Server Error` | Server encountered an error.     |

---

#### 2️⃣ Login Student
**🛠 Endpoint:** `POST /auth/student/login`  
**📌 Purpose:**  
Login into the student system.

### 📥 Input Parameters  

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `reg_email`    | String | ✅ Yes    | Registeration email |
| `password` | String | ✅ Yes    | Password |

### 🔄 Process  
1. Validate the request body.  
2. Check if the student exists.
3. Verify the given password.
4. Generate JWT (payload: {id, role: student}) and set Cookie.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 Completed`  
- **Message:** Student successfully logged-in. 

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `404 Bad Request Error`            | Student email does not exist or incorrect password          |
| `500 Internal Server Error` | Server encountered an error.     |

---

#### 3️⃣ Logout Student
**🛠 Endpoint:** `POST /auth/student/logout`  
**📌 Purpose:**  
Logout from the student system and clear authentication cookies.

### 📥 Input Parameters  
No input parameters required.

### 🔄 Process  
1. Clear JWT cookie
2. Invalidate the session

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`  
- **Message:** Successfully logged out.

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `401 Unauthorized`        | Not logged in                     |
| `500 Internal Server Error` | Server encountered an error.     |

---

#### 4️⃣ Reset Password
**🛠 Endpoint:** `POST /auth/student/reset-password`  
**📌 Purpose:**  
Reset student's password through email OTP verification.

### 📥 Input Parameters  

**Step 1 - Request OTP:**
| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `reg_email`    | String | ✅ Yes    | Registration email |

**Step 2 - Verify OTP & Reset Password:**
| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `reg_email`    | String | ✅ Yes    | Registration email |
| `otp`       | String | ✅ Yes    | OTP received via email |
| `new_password` | String | ✅ Yes    | New password |

### 🔄 Process  
1. Validate the request body
2. Check if the student exists
3. Generate and send OTP to registered email
4. Verify OTP and update password

### 📤 Output  
✅ **Success Response:**  
**Step 1:**
- **Status Code:** `200 OK`  
- **Message:** OTP sent successfully to registered email.

**Step 2:**
- **Status Code:** `200 OK`  
- **Message:** Password successfully reset.

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `404 Not Found`          | Student not found                 |
| `401 Unauthorized`        | Invalid or expired OTP           |
| `500 Internal Server Error` | Server encountered an error.     |


### Dashboard Endpoints

#### Get Data 
**🛠 Endpoint:** `GET /dashboard/student`

**📌 Purpose:**  
Fetch all neccessary information for dashboard

### 📥 Input Parameters  
No input parameters required.

### 🔄 Process  
1. Get student id from JWT(done using middleware).
2. Get student from database. 
3. Return all the required information.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 Completed`  
- **Message:** Student info sent.
- **Data:** 
```json  
{
    "status": 200,
    "message": "Student Info sent",
    "student": {
        "first_name": "Jaadu",
        "last_name": "Singh",
        "email": "jaadu.2022ug1042@iiitranchi.ac.in",
        "resume": "resume_url",
        "any_other_demands": "from_frontend_team"
    }
}
```

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `500 Internal Server Error` | Server encountered an error.     |

---

#### Update Dashboard
**🛠 Endpoint:** `PUT /dashboard/student`

**📌 Purpose:**  
Update given information.

### 📥 Input Parameters  

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `resume`    | File | ✅ Yes    | student resume |

### 🔄 Process  
1. Validate the request body.
2. Upload resume on cloud.
3. Get student id(from middleware)
4. Update the student's resume_url


### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`  
- **Message:** Resume updated successfully.


### Job Endpoints

#### Get Jobs
**🛠 Endpoint:** `GET /jobs?query={typeOfSearch}`

**query=** "all" | "intern" | "fte" | "intern_fte" 

**📌 Purpose:**  
Fetch neccessary jobs.

### 📥 Input Parameters  
**searchQuery:** "all" | "intern" | "fte" | "intern_fte"

### 🔄 Process  
1. Validate the search query.
2. Get details from DB.
3. Send response to the client.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`  
- **Message:** Jobs Fetched.
```json
{
    "statusCode": 200,
    "message": "Jobs fetched.",
    "jobs": [
        {
            "job_id": "4512",
            "company": "Instagram",
            "jd": "reel watcher",
            "job_location": "kambal",
            "compensation": "$3000000000",
            "date_of_joining": "raat 10 baje",
            "frontend_team": "check for missing details"
        },
        {
            "same details as above"
        }
    ]
}
```

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `500 Internal Server Error` | Server encountered an error.     |

#### Get Job
**🛠 Endpoint:** `GET /jobs/:id`

**id=** "4512" 

**📌 Purpose:**  
Fetch required job details.

### 📥 Input Parameters  
**id:** "4512"

### 🔄 Process  
1. Validate the search query.
2. Get details from DB.
3. Send response to the client.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`  
- **Message:** Jobs Fetched.
```json
{
    "statusCode": 200,
    "message": "Jobs fetched.",
    "jobs": [
        {
            "job_id": "4512",
            "company": "Instagram",
            "jd": "reel watcher",
            "job_location": "kambal",
            "compensation": "$3000000000",
            "date_of_joining": "raat 10 baje"
        }
    ]
}
```

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `500 Internal Server Error` | Server encountered an error.     |

### Apply for Job

#### Get Jobs
**🛠 Endpoint:** `POST /apply/job`

**📌 Purpose:**  
Apply for given job. 

### 📥 Input Parameters  
**job_id:** "4512"

### 🔄 Process  
1. Validate the search query.
2. Get details from DB.
3. Check if open to apply.
4. Add student to detail to Job.
5. Add job_id to student.
6. Send confirmation mail to student.

### 📤 Output  
✅ **Success Response:**  
- **Status Code:** `200 OK`  
- **Message:** Applied.
```json
{
    "statusCode": 200,
    "message": "Applied.",
    "jobs": [
        {
            "job_id": "4512",
            "company": "Instagram",
            "jd": "reel watcher",
            "job_location": "kambal",
            "compensation": "$3000000000",
            "date_of_joining": "raat 10 baje",
            "frontend_team": "check for missing details"
        }
    ]
}
```

### ❌ Error Responses  

| Status Code               | Description                       |
|---------------------------|-----------------------------------|
| `400 Request Validation Error`         | Invalid input parameters.         |
| `404 Bad Request Error`         | Error finding job. |
| `404 Bad Request Error`         | Job expired. |
| `500 Internal Server Error` | Server encountered an error.




