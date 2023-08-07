## Trello Admin User Management Scripts - Bulk Deactivate Inactive Users (Admin Hub Version)

This is an open source script to help Trelle Enterprise members bulk take away Trello product who have not been active in the last X days. You can customize how you define active.

---
### User Paramaters 
There are 6 variables that the user must input for the script to work:
- **Atlassian Admin API Key** - This is the API key used to authenticate with the Atlassian Admin API. You can generate one of these from the Admin Hub UI under the Security Tab. 
- **Trello API Token** - This is the API token used to authenticate that the script has permission to run the needed operations against the chosen Enterprise. The API token must be tied to a user of the Enterprise with Enterprise Admin Permissions. Make sure that your API token includes write permissions. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
 for more details. 
- **Trello API Key** - This is the API Key used to authenticate that the script has permission to run the needed operations against the chosen Enterprise. The API token must be tied to a user of the Enterprise with Enterprise Admin Permissions. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
- **Trello Enterprise ID** - This is the ID of the Enterprise that the user would like to run the script against. See the [Trello API documentation](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
- **Atlassian Org ID** - This is the ID of your Atlassian Org. You can retrieve this during the Atlassian Admin API key generation process noted above.
- **Trello Group ID** - This is the ID of the product user group that you have set up to give users Trello product access. The way users will have their product access taken away is by removing them from this group. You can retrive this ID by goingt to Admin Hub, navigating to the Group and then pulling the ID from the URL. 

 
In addition there are 5 customizations that the user can customize if they would like: 
- **testRun** - This script has a testRun mode. When testRun is set to true, the script will removing product access and give you a pre_run csv report but will not actually take away any product access. When testRun is set to false, it will take away product access from those users meet your activity paramater (see below).
- **runOnlyOnce** - This script can be configured to run 1x or if they user would like, run every X number of days. Set this value to true to run only once and false to run every X number of days. 
- **IntervalDays** - If the runOnlyOnce is set to false, then how often would you like the script to run. Enter this in number of days. 
- **daysSinceLastActive** - This variable defines how you want to define activity. By default this is set to 90 days. 
- **batchCount** - This variable allows you to define how many users you want to remove product access at once. The default value is 50. We do not recommend going much higher than this because you may get rate limited.

---
### Outputs
When this script is run, it will output two different report files:
- **Pre-run member report** - This is the CSV file that is generated before any members have their product access taken away. Review this report if you have set your testRun value to true.
- **Post-run member report** - This is the CSV file that is generated after to keep track of every user who has had their Trello product access taken away. Review his report to understand which users had their product access taken away after the script is done running. This report is is only generated if testRun is set to false.

## Have Questions?
Post on the Atlassian Community [here](https://community.atlassian.com/t5/Trello/ct-p/trello) and tag @Alexandros Mathopoulos.
