//------------------------------------------------------------------------------------------------------------
//User Editable Configurable Value
//Below are four variables you can edit to easily customize the script.
const runOnlyOnce = true; // set to true to run the script one time only and then exit

const intervalDays = 30; // set the number of days between script runs if runOnlyOnce is false

const daysSinceLastActive = 90; //set this to the maximum number of days since last access that a member can have to be considered for an Enterprise seat. Seats will be given to users who have been since the las X days. 
// set the batch count to be retrieved in each batch. The default value is 5.
const batchCount = 50;

const testRun = true // if this value is set to true, the script will simulate deactivating inactive users but will not actually deactivate them. Set to false if you would like to actually deactivate users. 

const removeFromEnterprise = false; 



//------------------------------------------------------------------------------------------------------------
//REQUIRED authintication credentials
//These are the credentials required to authenticate with the the Trello API. 

const apiKey = 'YOURAPIKEY'; //Enter your personal API key
const apiToken = 'YOURAPITOKEN'; //Enter your personal API token that was generated by the API key above
const enterpriseId = 'YOURENTERPRISEID'; //Enter the ID of the Trello Enterprise you want to add members to.


//------------------------------------------------------------------------------------------------------------
//Below this line is the main execution code. Edits below this line are not recommended unless you are trying to adapt the core funtionality of the script.

const headers = { 'Accept': 'application/json' };
const request = require('request');
const moment = require('moment');
const process = require('process');
const fs = require('fs');
const parse = require('csv-parse');
const timestamp = moment().format("YYYY-MM-DD-HHmmss")
let pulledBatches = 0; 
const MAX_RETRIES = 3
const RETRY_DELAY = 1000; 

// Helper function to handle retries. Set to retry 3 times with a 1000 ms delay between retries. 
async function withRetry(fn, maxRetries) {
  let attempts = 0;
  let error;

  while (attempts <= maxRetries) {
      try {
          return await fn();
      } catch (err) {
          error = err;
          attempts++;
          if (attempts <= maxRetries) {
              await new Promise(res => setTimeout(res, RETRY_DELAY));
          }
      }
  }

  throw error;
}



function putTogetherReport() {
  //creates csv file where where report will be stored 
  const csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Days Since Last Active', 'Last Active', 'Eligible For Deactivation']];

  fs.writeFileSync(`pre_run_member_report_${timestamp}.csv`, '');

  csvHeaders.forEach((header) => {
    fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, header.join(', ') + '\r\n');
  });

  // API endpoint to get list of Free Members
  let getManagedMembersUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members?fields=idEnterprisesDeactivated,fullName,memberEmail,username,dateLastAccessed&associationTypes=licensed&key=${apiKey}&token=${apiToken}&count=${batchCount}}`;

  async function processNextBatch(startIndex) {
    return new Promise(async (resolve, reject) => {
    let getNextBatchUrl = `${getManagedMembersUrl}&startIndex=${startIndex}`;

    const requestFn = () => new Promise((innerResolve, innerReject) => {  
    request.get({
      url: getNextBatchUrl,
      headers,
      json: true
    }, async (error, response, body) => {
      if (error) {
                    return innerReject(error);
                }
      if (response && response.statusCode !== 200) {
                    return innerReject(new Error(body || `HTTP Error: ${response.statusCode}`));
                }
      const membersResponse = body;
      pulledBatches = pulledBatches + 1;
      console.log(`Pulled batch #${pulledBatches} with ${membersResponse.length} members. Adding them to the list of users...`);
      if (!Array.isArray(membersResponse) || membersResponse.length === 0) {
        if (testRun === false) {
          console.log(`All members have been added to the report. See member_report_${timestamp}.csv in your directory. Now going to start deactivating inactive users...`);
          await beginDeactivatingUsers();
        }
        else { console.log(`Test run complete! All members have been added to the report. See member_report_${timestamp}.csv in your directory`) };
        innerResolve();
        return;
      }
      membersResponse.forEach((member) => {
        const daysActive = moment().diff(moment(member.dateLastAccessed), 'days');
        let eligible = ""
        if (daysActive > daysSinceLastActive) {eligible = "Yes"} else {eligible = "No"};
        const rowData = [member.memberEmail, member.id, member.fullName, daysActive, member.dateLastAccessed,eligible];
        fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, rowData.join(', ') + '\r\n');
      });
      await processNextBatch(startIndex + batchCount);
      innerResolve();
    });
 });

        try {
            await withRetry(requestFn, MAX_RETRIES);
            resolve();
        } catch (err) {
            console.error(`Failed to process batch starting from index ${startIndex} after ${MAX_RETRIES} retries. Error: ${err.message}`);
            reject(err);
        }
    });
}

processNextBatch(1);

}
              

async function beginDeactivatingUsers() {
    const post_timestamp = moment().format("YYYY-MM-DD-HHmmss");

    // Create csv file for the report
    const post_csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Days Since Last Active', 'Last Active', 'Eligible For Deactivation', 'Deactivated', 'Removed From Enterprise']];

    try {
        fs.writeFileSync(`post_run_member_report_${post_timestamp}.csv`, '');
        post_csvHeaders.forEach((header) => {
            fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, header.join(', ') + '\r\n');
        });

        // Read pre-csv file
        const pre_csvData = fs.readFileSync(`pre_run_member_report_${timestamp}.csv`, "utf-8");
        var pre_rows = pre_csvData.trim().split(/\r?\n/);

    } catch (err) {
        console.error('Error while reading or writing CSV:', err);
        return;
    }

    const apiRequests = pre_rows.map((pre_row, i) => async () => {
        return new Promise(async (resolve, reject) => {
        const cols = pre_row.split(",");
        const email = cols[0];
        const memberId = cols[1].trim();
        const daysActive = parseInt(cols[3]);

        const fullName = cols[2];
        const lastAccessed = cols[4];
        const isEligible = cols[5];

        if (daysActive > daysSinceLastActive) {
            if (!testRun) {
                const giveEnterpriseSeatUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members/${memberId}/licensed?key=${apiKey}&token=${apiToken}&value=false`;
                const data = { memberId: memberId };

                // This is the wrapped request logic with retries
                await withRetry(async () => {
                    const resp = await request.put({
                        url: giveEnterpriseSeatUrl,
                        headers: headers,
                        form: data,
                        json: true
                    }, (error, response, body)=>{
                        if (response.statusCode !== 200) {
                            throw new Error(`Failed to deactivate user: ${resp.body}`);
                        } else {
                            console.log(`Deactivated user ${email}`)
                            let removedFromEnterprise = "No"
                            if (removeFromEnterprise) {
                                const removeFromEnterpriseUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members/${memberId}/?key=${apiKey}&token=${apiToken}`;
                                const res =  request.delete({
                                    url: removeFromEnterpriseUrl,
                                    headers: headers,
                                    form: data,
                                    json: true
                                }, (error, response, body)=>{
                                    if (response.statusCode !== 200) {
                                        throw new Error(`Failed to remove user from enterprise: ${res.body}`);
                                    } else {
                                        console.log(`Removed user from enterprise: ${email}`);
                                        removedFromEnterprise = "Yes";
                                        const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'Yes', removedFromEnterprise];
                                        fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
                                    }

                                }
                                
                                );
    
                            } else {
                                const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'Yes', "No"];
              fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
                            }
                        }
                    }
                    
                    );
                    
                }, MAX_RETRIES);
            }
        } else {
            const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'No'];
            fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
          }
    });
    });


    try {
        await Promise.all(apiRequests.map(fn => fn()));
        console.log(`All done! Deactivated all inactive users! You can find the results in post_run_member_report_${post_timestamp}.csv.`);
    } catch (err) {
        console.error('Some errors occurred while processing members:', err);
    }
}

// run the job once if runOnlyOnce is true, otherwise schedule it to run every X days
if (runOnlyOnce) {
  console.log('Running bulk deactivation script one time only.');
  putTogetherReport();

} else {
  console.log(`Running bulk deactivation script automatically every ${intervalDays} days`);
  cron.schedule(`0 0 1 */${intervalDays} * *`, () => {
    console.log(`Running bulk deactivation script automatically every ${intervalDays} days`);
    putTogetherReport();
  });
  // run the job once on startup
  putTogetherReport();
}


