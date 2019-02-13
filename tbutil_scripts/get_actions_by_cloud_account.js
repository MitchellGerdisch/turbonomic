#! /usr/bin/env tbscript
/*
 * This javascript leverages the Turbonomic API client, tbutil and related tbscript capability.
 * See https://greencircle.vmturbo.com/docs/DOC-5897 for more information on tbutil.
 * 
 * To run the script:
 * 1) Install tbutil as per the above link. (The README in this folder also has installation steps.)
 * 2) Download this javascript.
 * 3) Make it executable
 * 4) Run by call it as such:
 *    get_actions_by_cloud_accounts.js -c @TURBO_CREDS_NAME
 *    Where TURBO_CREDS_NAME is the name of the creds you set up using tbutil save credentials - see documentation.
 * 
 * If interested in writing your own javascript that uses tbutil/tubscript, 
 * it is highly recommended you go through the PowerPoint attached to the above link.
 * Also, the above link provides a link to downloads which includes a REFERENCE.pdf that provides the javascript translation of the APIs.
 * 
 * And, although the PowerPoint covers this as well, it's worth noting that the 'tbutil' command itself has a nifty "what" option that you can use 
 * to find the corresponding javascript call for a given API.
 * So if I used Chrome javascript console to find the API call the UI uses when getting a list of actions for a given account, 
 * I can then run this where I have tbutil installed:
 *	tbutil what get 'https://localhost/vmturbo/rest/businessunits/123456/actions'
 *
 * and I'm informed that the javascript API function to use is:
 * 	client.getCurrentBusinessUnitActions( businessUnit_Uuid, _options )
 * 
 * I can then look at the REFERENCE.pdf document that is provided along with the tbutil downloads to see what the options are
 * This API function is used below so you can see how all this hangs together if you want.
 * 
 */

// Get the cloud accounts connected to the turbo box
var opts = {
		type: "DISCOVERED"
}
BUs = client.getBusinessUnits(opts)

var headers = [ "Account Name", "Cloud Provider", "Cloud Account ID", "Action to Take", "Target Name", "Target UUID" ]
var rows = []

for (var i = 0; i < BUs.length; i +=1) {
	BU = BUs[i]
	if (BU.hasRelatedTarget) {
		// Grab some pertinent attributes
		bu_displayName = BU.targets[0].displayName // the name of the account as it was defined when creating the target 
		bu_cloudType = BU.cloudType // AWS, Azure, etc
		bu_uuid = BU.uuid // The cloud account ID
		
		// Now go and get the actions for each account
		buActions = client.getCurrentBusinessUnitActions( bu_uuid, {} ) // no options need to be passed 
		
		for (var j = 0; j < buActions.length; j +=1) {
			buAction = buActions[j]
			action_statement = buAction.details
			target_uuid = buAction.target.uuid
			target_name = buAction.target.displayName
			rows.push([bu_displayName, bu_cloudType, bu_uuid, action_statement, target_name, target_uuid])
		}
			
	}
}

//printTable(headers, rows)
printCsv(headers, rows)

return 0;