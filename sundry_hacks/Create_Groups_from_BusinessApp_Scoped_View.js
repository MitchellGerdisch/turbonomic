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
var static_filter_ba_vms = []
var static_filter_ba_dbs = []

fetch('/vmturbo/rest/search/?q=&scopes='+scope_id).then(res => {
	return res.json();
}).then(actions => {
	actions.map(record => {
		return_line = "";
		if (record.className == "BusinessApplication") {
			ba_name = record.displayName
		} 
		else if (record.className == "VirtualMachine") {
			static_filter_ba_vms.push(record.uuid)
		} else if (record.className == "DatabaseServer") {
			static_filter_ba_dbs.push(record.uuid)
		}

	});
	console.log("Business Application Name: "+ba_name)
	console.log("VMs in Bus App: "+static_filter_ba_vms)
	console.log("DB Servers in Bus App: "+static_filter_ba_dbs)
	/* Build the vm and db groups for the application
	 */
	
	group_url = '/api/v2/groups'
	search_url = '/api/v2/search?q='

	if (static_filter_ba_vms.length > 0) {
		group_name = "BusApp_VMs_"+ba_name
		api_method = 'POST' /* assume we are creating a new group */
		/* Check if group already exists */
		search_url = '/api/v2/search?q='
		response = fetch(search_url+group_name)
			.then((resp) => resp.json())
			.then(function(data) {
				if (data.length > 0) {
					console.log("data: "+data[0])
					return({
						api_method: 'PUT',
						group_url: group_url+data[0].uuid
					})
				}
			})
		console.log("response: "+response)
		
		
		
		vms_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": static_filter_ba_vms,
			"criteriaList": [],
			"groupType": "VirtualMachine"
		}
		fetch(group_url, {
			method: api_method,
			body: JSON.stringify(vms_group_body),
		    headers: {
		        'Content-Type': 'application/json'
		      }
		})
		
		console.log("Created VM Group: "+group_name)
	}

	if (static_filter_ba_dbs.length > 0) {
		group_name = "BusApp_DBs_"+ba_name
		api_method = 'POST'
		dbs_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": static_filter_ba_dbs,
			"criteriaList": [],
			"groupType": "DatabaseServer"
		}
		fetch(group_url, {
			method: api_method,
			body: JSON.stringify(dbs_group_body),
		    headers: {
		        'Content-Type': 'application/json'
		      }
		})
		console.log("Created DB Server Group: "+group_name)

	}
	
});
