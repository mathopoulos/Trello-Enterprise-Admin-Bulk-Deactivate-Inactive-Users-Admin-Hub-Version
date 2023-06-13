## Trello Admin User Management Scripts

This is an open source script to help Trelle Enterprise members bulk deactivate members who have not been active in the last X days. You can customize how you define active. For more details on how exactly to use this script, see this video below: 

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/GwvZ0KWFiCM/0.jpg)](https://www.youtube.com/watch?v=GwvZ0KWFiCM) 


---
### User Paramaters 

There are 3 variables that the user must input for the script to work:

- **API Token** - This is the API token used to authenticate that the script has permission to run the needed operations against the chosen Enterprise. The API token must be tied to a user of the Enterprise with Enterprise Admin Permissions. Make sure that your API token includes write permissions. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
 for more details. 

- **API Key** - This is the API Key used to authenticate that the script has permission to run the needed operations against the chosen Enterprise. The API token must be tied to a user of the Enterprise with Enterprise Admin Permissions. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)

- **Enterprise ID** - This is the ID of the Enterprise that the user would like to run the script against. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)

 

In addition there are 5 customizations that the user can customize if they would like: 
- **testRun** - This script has a testRun mode. When testRun is set to true, the script will simulate deactivating members and give you a pre_run csv report but will not actually deactivate any members. When testRun is set to false, it will actually deactivate members who meet your activity paramaters (see below).

- **runOnlyOnce** - This script can be configured to run 1x or if they user would like, run every X number of days. Set this value to true to run only once and false to run every X number of days. 

- **IntervalDays** - If the runOnlyOnce is set to false, then how often would you like the script to run. Enter this in number of days. 

- **daysSinceLastActive** - This variable defines how you want to define activity. By default this is set to 90 days. 

- **batchCount** - This variable allows you to define how many users you want to give Enterprise seats at once. When first testing this script we recommend setting this to 5 to confirm that it is running correctly and then setting this value to 100.

---
### Outputs
When this script is run, it will output two different report files:
- **Pre-run member report** - This is the CSV file that is generated before any members are deactivated. Review this report if you have set your testRun value to true.
- **Post-run member report** - This is the CSV file that is generated after to keep track of every user who has been deactivated. Review his report to understand which users where given a seat after the script is done running. This report is is only generated if testRun is set to false.

## Have Questions?
Post on the Atlassian Community [here](https://community.atlassian.com/t5/Trello/ct-p/trello) and tag @Alexandros Mathopoulos. 
