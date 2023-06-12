//------------------------------------------------------------------------------------------------------------
//User Editable Configurable Value
//Below are four variables you can edit to easily customize the script.
const runOnlyOnce = true; // set to true to run the script one time only and then exit

const intervalDays = 30; // set the number of days between script runs if runOnlyOnce is false

const daysSinceLastActive = 90; //set this to the maximum number of days since last access that a member can have to be considered for an Enterprise seat. Seats will be given to users who have been since the las X days. 
// set the batch count to be retrieved in each batch. The default value is 5.
const batchCount = 5;

const testRun = true // if this value is set to true, the script will simulate deactivating inactive users but will not actually deactivate them. Set to false if you would like to actually deactivate users. 



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



function putTogetherReport() {
  //creates csv file where where report will be stored 
  const csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Days Since Last Active', 'Last Active', 'Eligible For Deactivation']];

  fs.writeFileSync(`pre_run_member_report_${timestamp}.csv`, '');

  csvHeaders.forEach((header) => {
    fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, header.join(', ') + '\r\n');
  });

  // API endpoint to get list of Free Members
  let getManagedMembersUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members?fields=idEnterprisesDeactivated,fullName,memberEmail,username,dateLastAccessed&associationTypes=licensed&key=${apiKey}&token=${apiToken}&count=${batchCount}}`;

  function processNextBatch(startIndex) {
    let getNextBatchUrl = `${getManagedMembersUrl}&startIndex=${startIndex}`;

    request.get({
      url: getNextBatchUrl,
      headers,
      json: true
    }, (error, response, body) => {
      const membersResponse = body;
      pulledBatches = pulledBatches + 1;
      console.log(`Pulled batch #${pulledBatches} with ${membersResponse.length} members. Adding them to the list of users...`);
      if (!Array.isArray(membersResponse) || membersResponse.length === 0) {
        if (testRun === false) {
          console.log(`All members have been added to the report. See member_report_${timestamp}.csv in your directory. Now going to start deactivating inactive users...`);
          beginGivingSeats();
        }
        else { console.log(`Test run complete! All members have been added to the report. See member_report_${timestamp}.csv in your directory`) };
        return;
      }
      membersResponse.forEach((member) => {
        const daysActive = moment().diff(moment(member.dateLastAccessed), 'days');
        let eligible = ""
        if (daysActive > daysSinceLastActive) {eligible = "Yes"} else {eligible = "No"};
        const rowData = [member.memberEmail, member.id, member.fullName, daysActive, member.dateLastAccessed,eligible];
        fs.appendFileSync(`pre_run_member_report_${timestamp}.csv`, rowData.join(', ') + '\r\n');
      });
      processNextBatch(startIndex + batchCount);
    });
  }

  processNextBatch(1);
}
              

function beginGivingSeats() {
  const post_timestamp = moment().format("YYYY-MM-DD-HHmmss")
  //creates csv file where where report will be stored 
  const post_csvHeaders = [['Member Email', 'Member ID', 'Member Full Name', 'Days Since Last Active', 'Last Active', 'Eligible For Deactivation', 'Deactivated']];
  fs.writeFileSync(`post_run_member_report_${post_timestamp}.csv`, '');
  
  post_csvHeaders.forEach((header) => {
      fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, header.join(', ') + '\r\n');
    });
  
  // read pre csv file
  const pre_csvData = fs.readFileSync(`pre_run_member_report_${timestamp}.csv`, "utf-8");


  // split csv rows into an array
  const pre_rows = pre_csvData.trim().split(/\r?\n/);

  // process each row
   pre_rows.forEach((pre_row, i) => {
    const cols = pre_row.split(",");
    const email = cols[0];
    const memberId = cols[1].trim();
    const daysActive = parseInt(cols[3]);
    
    const fullName = cols[2];
    const lastAccessed = cols[4];
    const isEligible = cols[5];
    if (daysActive > daysSinceLastActive) {
      setTimeout(() => {
        if (!testRun) {
          const giveEnterpriseSeatUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members/${memberId}/licensed?key=${apiKey}&token=${apiToken}&value=false`;
          const data = { memberId:memberId };
           
          request.put({
            url: giveEnterpriseSeatUrl,
            headers: headers,
            form: data, 
          }, (error, response, body) => {
            if (!error && response.statusCode ===200) {
              console.log(`Deactivated member: ${fullName} with email ${email}`);
              const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'Yes'];
              fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');
            } else {
              console.log(`There was an error deactivating ${email}: ${body}`)
            }
          });
        }
      }, i * 500);
    } else {
      const rowData = [email, memberId, fullName, daysActive, lastAccessed, isEligible, 'No'];
      fs.appendFileSync(`post_run_member_report_${post_timestamp}.csv`, rowData.join(', ') + '\r\n');

    }
  });
};

// run the job once if runOnlyOnce is true, otherwise schedule it to run every X days
if (runOnlyOnce) {
  console.log('Running script one time only.');
  putTogetherReport();

} else {
  console.log(`Running script automatically every ${intervalDays} days`);
  cron.schedule(`0 0 1 */${intervalDays} * *`, () => {
    console.log(`Running script automatically every ${intervalDays} days`);
    putTogetherReport();
  });
  // run the job once on startup
  putTogetherReport();
}