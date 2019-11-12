/*
* Documented in Green Circle article, DOC-TBD
* If this script is changed, be sure to update the article.
* 
* CAVEATS: 
* 	This is a super-sunny day script. It doesn't do any error checking.
* 	This script ONLY works for Business Application scoped views.
* 
* NOTE: If you do see an error running the script, chances are the problem is that the group already exists.
* 
* How it works:
* When you are in a given real-time scoped view for a Business Application running this script from that view's javascript console developer tool will create
* two groups:
* BusApp_VMs_<BUSINESS APP NAME>: A group that contains the VMs for that scoped view, assuming there are some.
* BusApp_DBs_<BUSINESS APP NAME>: A group that contains the DB servers for that scoped view, assuming there are some.
*/


var thisurl = document.URL;
/* console.log("URL: "+thisurl); */
var url_array = thisurl.split('/');
var scope_id = url_array[url_array.length-1];
/* console.log("SCOPE ID: "+scope_id); */

/* Walk through the view and get/create the following items:
 * business application name used to create the groups
 * list of VMs in the business application
 * list of DB servers in the business applicaiton
 */

var ba_name = "BA NAME NOT FOUND"
var ba_vms = ""
var ba_dbs = ""

fetch('/vmturbo/rest/search/?q=&scopes='+scope_id).then(res => {
	return res.json();
}).then(actions => {
	actions.map(record => {
		return_line = "";
		if (record.className == "BusinessApplication") {
			ba_name = record.displayName
		} 
		else if (record.className == "VirtualMachine") {
			if (ba_vms) {
				ba_vms = ba_vms + "|" + record.displayName
			}
			else {
				ba_vms = record.displayName
			}
		} else if (record.className == "DatabaseServer") {
			if (ba_dbs) {
				ba_dbs = ba_dbs + "|" + record.displayName
			}
			else {
				ba_dbs = record.displayName
			}
		}

	});
	console.log("Business Application Name: "+ba_name)
	console.log("VMs in Bus App: "+ba_vms)
	console.log("DB Servers in Bus App: "+ba_dbs)
	/* Build the vm and db groups for the application
	 */
	
	group_url = '/api/v2/groups'

	if (ba_vms) {
		
		group_name = "BusApp_VMs_"+ba_name
		vms_group_body = {
			"isStatic": false,
			"displayName": group_name,
			"memberUuidList": [
			],
			"criteriaList": [
			{
				"expType": "RXEQ",
	  			"expVal": ba_vms,
	  			"filterType": "vmsByName",
	  			"caseSensitive": true
			}
			],
			"groupType": "VirtualMachine"
		}
		fetch(group_url, {
			method: 'POST',
			body: JSON.stringify(vms_group_body),
		    headers: {
		        'Content-Type': 'application/json'
		      }
		})
		
		console.log("Created VM Group: "+group_name)
	}

	if (ba_dbs) {
		
		group_name = "BusApp_DBs_"+ba_name
		dbs_group_body = {
			"isStatic": false,
			"displayName": group_name,
			"memberUuidList": [
			],
			"criteriaList": [
			{
				"expType": "RXEQ",
	  			"expVal": ba_dbs,
	  			"filterType": "databaseServerByName",
	  			"caseSensitive": true
			}
			],
			"groupType": "DatabaseServer"
		}
		fetch(group_url, {
			method: 'POST',
			body: JSON.stringify(dbs_group_body),
		    headers: {
		        'Content-Type': 'application/json'
		      }
		})
		console.log("Created DB Server Group: "+group_name)

	}
	
});
