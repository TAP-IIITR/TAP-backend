import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION1 || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID1 || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY1 || "",
  },
});

/**
 * Send email using AWS SES
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - Email body in HTML format
 * @param textBody - Email body in plain text format
 * @returns Promise resolving to the SES response
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody: string
) => {
  const toAddresses = Array.isArray(to) ? to : [to];

  const params = {
    Source: "wc.placements@iiitranchi.ac.in",
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: "UTF-8",
        },
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return response;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

/**
 * Generate job notification email content
 * @param jobDetails - Details of the job
 * @returns Object containing HTML and text versions of the email
 */
export const generateJobNotificationEmail = (jobDetails: any) => {
  const { title, company, location, package: salaryPackage, deadline, eligibility, jobType } = jobDetails;
  
  const htmlBody = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #003366; color: white; padding: 15px 20px; text-align: center; }
          .content { padding: 20px; border: 1px solid #ddd; }
          .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
          h1 { color: #003366; font-size: 22px; }
          .details { margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #003366; }
          .detail-item { margin-bottom: 10px; }
          .detail-label { font-weight: bold; color: #003366; }
          .cta-button { 
            display: inline-block; 
            background-color: #003366; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 4px; 
            margin-top: 15px;
          }
          .institute-name { font-weight: bold; }
          .salutation { margin-bottom: 15px; }
          .signature { margin-top: 25px; color: #333; }
          .job-type-tag {
            display: inline-block;
            background-color: #e6f0ff;
            color: #003366;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            margin-left: 10px;
            vertical-align: middle;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Training & Placement Cell</h2>
            <div>Indian Institute of Information Technology, Ranchi</div>
          </div>
          <div class="content">
            <div class="salutation">Dear Student,</div>
            
            <p>The Training and Placement Cell, IIIT Ranchi is pleased to announce a new placement opportunity that aligns with your academic qualifications:</p>
            
            <h1>${title} at ${company} <span class="job-type-tag">${jobType}</span></h1>
            
            <div class="details">
              <div class="detail-item">
                <span class="detail-label">Position:</span> ${title}
              </div>
              <div class="detail-item">
                <span class="detail-label">Organization:</span> ${company}
              </div>
              <div class="detail-item">
                <span class="detail-label">Type:</span> ${jobType}
              </div>
              <div class="detail-item">
                <span class="detail-label">Location:</span> ${location}
              </div>
              <div class="detail-item">
                <span class="detail-label">Compensation:</span> ${salaryPackage}
              </div>
              <div class="detail-item">
                <span class="detail-label">Eligibility Criteria:</span> ${eligibility}
              </div>
              <div class="detail-item">
                <span class="detail-label">Application Deadline:</span> ${new Date(
                  deadline
                ).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            
            <p>Interested candidates are requested to log in to the Training and Placement portal to view the complete job description and submit their applications before the deadline.</p>
            
            <p style="text-align: center;">
              <a href="https://tap-iiitr-three.vercel.app/login" class="cta-button">Login to Apply</a>
            </p>
            
            <div class="signature">
              <p>Best Regards,</p>
              <p class="institute-name">Training and Placement Cell</p>
              <p>Indian Institute of Information Technology, Ranchi</p>
            </div>
          </div>
          <div class="footer">
            <p>This is an official communication from the Training and Placement Cell, IIIT Ranchi.</p>
            <p>Please do not reply to this email. For any queries, kindly contact the T&P Cell at wc.placements@iiitranchi.ac.in</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textBody = `
    INDIAN INSTITUTE OF INFORMATION TECHNOLOGY, RANCHI
    TRAINING AND PLACEMENT CELL
    
    Dear Student,
    
    The Training and Placement Cell, IIIT Ranchi is pleased to announce a new placement opportunity that aligns with your academic qualifications:
    
    ${title.toUpperCase()} at ${company.toUpperCase()} [${jobType}]
    
    Position: ${title}
    Organization: ${company}
    Type: ${jobType}
    Location: ${location}
    Compensation: ${salaryPackage}
    Eligibility Criteria: ${eligibility}
    Application Deadline: ${new Date(deadline).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}
    
    Interested candidates are requested to log in to the Training and Placement portal to view the complete job description and submit their applications before the deadline.
    
    Please visit: https://tap-iiitr-three.vercel.app/login
    
    Best Regards,
    Training and Placement Cell
    Indian Institute of Information Technology, Ranchi
    
    ---
    This is an official communication from the Training and Placement Cell, IIIT Ranchi.
    Please do not reply to this email. For any queries, kindly contact the T&P Cell at wc.placements@iiitranchi.ac.in
  `;

  return { htmlBody, textBody };
};
