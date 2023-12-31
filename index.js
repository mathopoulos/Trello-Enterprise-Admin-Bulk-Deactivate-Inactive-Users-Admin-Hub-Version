//------------------------------------------------------------------------------------------------------------
//User Editable Configurable Value
//Below are four variables you can edit to easily customize the script.
const runOnlyOnce = true; // set to true to run the script one time only and then exit

const intervalDays = 90; // set the number of days between script runs if runOnlyOnce is false

const daysSinceLastActive = 90; //seats will be given to users who have been since the last X days. 

const batchCount = 50; // the number of users that will be retrieved with each call. The default value is 50. We recommend not increasing this number (to avoid rate limiting)

const testRun = True // if this value is set to true, the script will simulate removing product access from inactive members but will not actually take away access. Set to false if you would like to actually take away product access. 

const trelloGroupId = 'Insert Trello Group ID' // The Trello Product Access group that determines whether a user has Trello product access. This is the group the user will be removed from. 

//------------------------------------------------------------------------------------------------------------
//REQUIRED authintication credentials
//These are the credentials required to authenticate with the the Trello API. 

const atlassianApiKey = 'Insert Atlassian Admin API Key ';
const apiKey = 'Insert Trello API Key'; //Enter your personal Trello API key
const apiToken = 'Insert Trello API Token'; //Enter your personal API token that was generated by the API key above
const enterpriseId = 'Insert Trello Enterprise ID'; //Enter the ID of the Trello Enterprise you want to add members to.
const orgId = 'Insert Atlassian Org ID'


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

// Function to put together pre-report and then kickoff functions to remove eligible users. 
function putTogetherReport() {
  //creates csv file where where report will be test/pre run user report will be stored 
  const csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Trello Access','Days Since Last Active', 'Last Active', 'Eligible For Deactivation']];
  fs.writeFileSync(`pre_run_member_report_${timestamp}.csv`, '');
  csvHeaders.forEach((header) => {
    fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, header.join(', ') + '\r\n');
  });

  // API endpoint to get list of Atlassian users
  //let getManagedMembersUrl = `https://api.trello.com/1/enterprises/${enterpriseId}/members?fields=idEnterprisesDeactivated,fullName,memberEmail,username,dateLastAccessed&associationTypes=licensed&key=${apiKey}&token=${apiToken}&count=${batchCount}}`;

  let getManagedMembersUrl = `https://api.atlassian.com/admin/v1/orgs/${orgId}/users`

  // Function to pull the next set of users 
  async function processNextBatch(nextUrl) {
    return new Promise(async (resolve, reject) => {
        const getNextBatchUrl = nextUrl;

        
        const requestFn = () => new Promise((innerResolve, innerReject) => {
            if (getNextBatchUrl !== undefined) {
            request.get({
                url: getNextBatchUrl,
                headers: {
                    'Authorization': `Bearer ${atlassianApiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  },
                json: true
            }, async (error, response, body) => {
                if (error) {
                    return innerReject(error);
                }

                if (response && response.statusCode !== 200) {
                    return innerReject(new Error(body || `HTTP Error: ${response.statusCode}`));
                }

                const membersResponse = body.data;
                let nextUrl = body.links.next
                pulledBatches = pulledBatches + 1;
                console.log(`Pulled batch #${pulledBatches} with ${membersResponse.length} members. Adding them to the list of users...`);


                membersResponse.forEach((member) => {
                    let trelloProductAccsss = false;
                    let dateLastAccessed
                    if (member.product_access.some(product=> product.name === 'Trello')) {
                      trelloProductAccsss = true; 
                    } else {
                      trelloProductAccsss = false;
                    }

                    if (trelloProductAccsss === true) {
                        member.product_access.forEach(product => {
                            if (product.name === 'Trello') {
                                dateLastAccessed = product.last_active
                            }
                        })
                    };
                    const daysActive = moment().diff(moment(dateLastAccessed), 'days');
                    let eligible = "";
                    if (daysActive > daysSinceLastActive) {
                        eligible = "Yes";
                    } else {
                        eligible = "No";
                    }
                    const rowData = [member.email, member.account_id, member.name, trelloProductAccsss, daysActive, dateLastAccessed,eligible];
                    fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, rowData.join(', ') + '\r\n');
                });

                // process next batch recursively
                await processNextBatch(nextUrl);
                innerResolve();
            });
    } else {
        if (testRun === false) {
            console.log(`All members have been added to the report. See member_report_${timestamp}.csv in your directory. Now going to start deactivating inactive users...`);
            
            beginTakingAwaySeats();
        } else {
            console.log(`Test run complete! All members have been added to the report. See member_report_${timestamp}.csv in your directory`);
        }
        innerResolve();
        return;
    }

});

        try {
            await withRetry(requestFn, MAX_RETRIES);
            resolve();
        } catch (err) {
            console.error(`Failed to process batch after ${MAX_RETRIES} retries. Error: ${err.message}`);
            reject(err);
        }
    });
}

processNextBatch(getManagedMembersUrl);

}
              
// Function that actually remove product access. 
async function beginTakingAwaySeats() {
    const post_timestamp = moment().format("YYYY-MM-DD-HHmmss");
    const post_csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Days Since Last Active', 'Last Active', 'Eligible For Removal', 'Removed']];
    let pre_rows;
    try {
      fs.writeFileSync(`post_run_member_report_${post_timestamp}.csv`, '');
      post_csvHeaders.forEach((header) => {
        fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, header.join(', ') + '\r\n');
      });
  
      const pre_csvData = fs.readFileSync(`pre_run_member_report_${timestamp}.csv`, "utf-8");
      pre_rows = pre_csvData.trim().split(/\r?\n/);
    } catch (err) {
      console.error('Error while reading or writing CSV:', err);
      throw err;
    }
  
    async function deleteMemberWithDelay(email, memberId, fullName, daysActive, lastAccessed, isEligible) {
      return new Promise((resolve, reject) => {
        const deleteUrl = `https://api.atlassian.com/admin/v1/orgs/${orgId}/directory/groups/${trelloGroupId}/memberships/${memberId}`;
        request.delete({
          url: deleteUrl,
          headers: {
            'Authorization': `Bearer ${atlassianApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        }, (error, response, body) => {
          if (error) {
            return reject(error);
          }
  
          if (response.statusCode === 200) {
            console.log(`Removed member: ${fullName} with email ${email} from Trello Product Access Group`)
            const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'Yes'];
            fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
            resolve();
          } else {
            reject(new Error(body || `HTTP Error: ${response.statusCode}`));
          }
        });
      });
    }
  
    const apiRequests = pre_rows.map((pre_row, i) => {
      return new Promise(async (resolve, reject) => {
        const cols = pre_row.split(",");
        const email = cols[0];
        const memberId = cols[1].trim();
        const daysActive = parseInt(cols[4]);
        const fullName = cols[2];
        const lastAccessed = cols[5];
        const isEligible = cols[6].trim();
  
        try {
          if (isEligible === "Yes") {
            await deleteMemberWithDelay(email, memberId, fullName, daysActive, lastAccessed, isEligible);
            // Add a delay after each delete API call (e.g., 1 second)
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'No'];
            fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
          }
          resolve();
        } catch (err) {
        const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'No'];
        fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
          console.error(`Failed to process ${email} after ${MAX_RETRIES} retries. Error: ${err.message}`);
          reject(err);
        }
      });
    });
  
    try {
      await Promise.all(apiRequests);
      //console.log(`All done! Deactivated all inactive users! You can find the results in post_run_member_report_${post_timestamp}.csv.`);
    } catch (err) {
      //console.error('Some errors occurred while processing members:', err);
    }
  };

// run the job once if runOnlyOnce is true, otherwise schedule it to run every X days
if (runOnlyOnce) {
  console.log('Running bulk licensing script one time only.');
  putTogetherReport();

} else {
  console.log(`Running bulk licensing script automatically every ${intervalDays} days`);
  cron.schedule(`0 0 1 */${intervalDays} * *`, () => {
    console.log(`Running bulk licensing script automatically every ${intervalDays} days`);
    putTogetherReport();
  });
  // run the job once on startup
  putTogetherReport();
}
