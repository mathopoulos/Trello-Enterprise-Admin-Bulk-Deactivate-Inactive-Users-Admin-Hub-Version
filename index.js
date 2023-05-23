//User Editable values
//Below are twi values you can edit to easy customize the script. 
const daysSinceLastActive = 90; //set this to the maximum number of days since last access that a member can have to be considered for an Enterprise seat. Seats will be given to users who have been since the las X days. 
// set the batch count to be retrieved in each batch. The default value is 5.
const batchCount = 100;

//--Above this line is the code to be edited by the user----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const request = require('request');
const moment = require('moment');

const apiKey = 'YOURAPIKEY';
const apiToken = 'YOURAPITOKEN';
const enterpriseId = 'YOURENTERPRISEID';
const headers = { 'Accept': 'application/json' };

let membersAssigned = 0;
let membersSkipped = 0;
let lastMemberIndex = 0; 

function processNextBatch() {
  let getManagedMembersUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members?fields=username,dateLastAccessed&associationTypes=licensed&key=${apiKey}&token=${apiToken}&count=${batchCount}}`;
  if (membersSkipped > 0) {
    getManagedMembersUrl = getManagedMembersUrl + `&startIndex=${lastMemberIndex}`;
    membersSkipped=0;
  };
  request.get({
    url: getManagedMembersUrl,
    headers: headers,
    json: true
  }, (error, response, body) => {
    const membersResponse = body;
    console.log(`Pulled our batch of ${membersResponse.length} members. Starting to give them Enterprise seats now...`);
    if (!Array.isArray(membersResponse) || membersResponse.length === 0) {
      console.log("No more members to process");
      return;
    }
    membersResponse.forEach((member) => {
      const daysActive = moment().diff(moment(member.dateLastAccessed), 'days');
      if (daysActive > daysSinceLastActive) {
        const giveEnterpriseSeatUrl = `https://trellis.coffee/1/enterprises/${enterpriseId}/members/${member.id}/licensed?key=${apiKey}&token=${apiToken}&value=false`;
        const data = { memberId: member.id };
        request.put({
          url: giveEnterpriseSeatUrl,
          headers: headers,
          form: data
        }, (error, response, body) => {
          const licensedResponse = JSON.parse(body);
          membersAssigned += 1;
          console.log(`Gave an Enterprise Seat to member: ${member.username}. Have now assigned a total of ${membersAssigned} Enterprise seats.`);
        });
      } else {
        console.log(`${member.username} has not been active so we did not give them an Enterprise Seat.`);
        membersSkipped +=1;
      }
    });
    console.log(lastMemberIndex);
    lastMemberIndex += membersSkipped + 1;
    setTimeout(processNextBatch, 5000);
  });
}
processNextBatch();