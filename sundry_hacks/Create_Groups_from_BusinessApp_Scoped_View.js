/*
* Documented in Green Circle article, DOC-6513
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

function CreateUpdate_Group(group_url, api_method, body) {
	fetch(group_url, {
		method: api_method,
		body: JSON.stringify(body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
}

/* MAIN */
var thisurl = document.URL;
/* console.log("URL: "+thisurl); */
var url_array = thisurl.split('/');
var scope_id = url_array[url_array.length-1];
/* console.log("SCOPE ID: "+scope_id); */

/* Walk through the view and get/create the following items:
 * business application name used to create the groups
 * array of VMs in the business application
 * array of DB servers in the business applicaiton
 */

var ba_name = "BA NAME NOT FOUND"
var ba_vms = []
var ba_dbs = []

fetch('/vmturbo/rest/search/?q=&scopes='+scope_id).then(res => {
	return res.json();
}).then(actions => {
	actions.map(record => {
		return_line = "";
		if (record.className == "BusinessApplication") {
			ba_name = record.displayName
		} 
		else if (record.className == "VirtualMachine") {
			ba_vms.push(record.uuid)
		} else if (record.className == "DatabaseServer") {
			ba_dbs.push(record.uuid)
		}

	});
	console.log("Business Application Name: "+ba_name)
	console.log("VMs in Bus App: " + ((ba_vms.length > 0) ? ba_vms : "NONE FOUND"))
	console.log("DB Servers in Bus App: " + ((ba_dbs.length > 0) ? ba_dbs : "NONE FOUND"))
	
	group_url = '/api/v2/groups'
	search_url = '/api/v2/search?q='

	/* Did we find any VMs in the Bus app? */
	if (ba_vms.length > 0) {
		group_name = "BusApp_VMs_"+ba_name
		vms_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": ba_vms,
			"criteriaList": [],
			"groupType": "VirtualMachine"
		}
		
		/* Either create a new group of Bus App VMs or update the existing group if it already exists. */
		fetch(search_url+group_name)
		.then(
			function(response) {
				if (response.status !== 200) {
					console.log("*** There was a problem checking group existing: "+response.status);
					return;
				}
				response.json().then(
					function(data) {
						if (data.length > 0) {
							/* Found an existing group, so update it. */
							CreateUpdate_Group(group_url+"/"+data[0].uuid, 'PUT', vms_group_body) 
							console.log("Updated VM Group: "+group_name)
						} else {
							/* Create a new group */
							CreateUpdate_Group(group_url, 'POST', vms_group_body) 
							console.log("Created VM Group: "+group_name)
						}
				});
		});
	}

	/* Did we find any DB servers in the Bus app? */
	if (ba_dbs.length > 0) {
		group_name = "BusApp_DBs_"+ba_name
		dbs_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": ba_dbs,
			"criteriaList": [],
			"groupType": "DatabaseServer"
		}
		
		/* Either create a new group of Bus App DBs or update the existing group if it already exists. */
		fetch(search_url+group_name)
		.then(
			function(response) {
				if (response.status !== 200) {
					console.log("*** There was a problem checking group existing: "+response.status);
					return;
				}
				response.json().then(
					function(data) {
						if (data.length > 0) {
							/* Found an existing group, so update it. */
							CreateUpdate_Group(group_url+"/"+data[0].uuid, 'PUT', dbs_group_body) 
							console.log("Updated DB Server Group: "+group_name)
						} else {
							/* Create a new group. */
							CreateUpdate_Group(group_url, 'POST', dbs_group_body) 
							console.log("Created DB Server Group: "+group_name)
						}
				});
		});
	}
	
});
