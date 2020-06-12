/*
 * NAME: Create_Business_Application_VMandDB_Groups_Classic
 * 
 * CAVEATS: 
 * 	This is a pretty much sunny day script. It doesn't do any error checking.
 * 	This script ONLY works for Business Applications.
 * 
 * How to Use:
 * First, copy the script into Chrome Javascript console.
 * Then you have three ways of running the script:
 * 1) Navigate to a scoped view of a given Business Application in the Turbo UI. I.e. Search -> Business Applications and select a given application.
 *    Then, enter "CreateBusAppGroups("scoped") to create VM and/or DB server groups for the given Business Application in view.
 * 2) Enter "CreateBusAppGroups("all") to create VM and/or DB server groups for every Business Application.
 *    Note: You do NOT need to be in a scoped view for this command.
 * 3) Enter "CreateBusAppGroups("<BUSINESS_APP_NAME>") to create VM and/or DB server groups for the given, named Business Application.
 *    Note: You do NOT need to be in a scoped view for this command.
 * 
 * 
 * What it Produces:
 * Up to two groups for the Business Application with a naming convention as follows:
 * - BusApp_VMs_<BUSINESS APP NAME>: A group that contains the VMs for that scoped view, assuming there are some.
 * - BusApp_DBs_<BUSINESS APP NAME>: A group that contains the DB servers for that scoped view, assuming there are some.
 */



/* Main function called to build groups 
 * Usage:
 * - CreateBusAppGroups("scoped"): Produces VM/DB group(s) for Business Application currently scoped in the Turbo UI view.
 * - CreateBusAppGroups("all"): Produces VM/DB groups for ALL Business Applications known by the Turbo instance.
 * - CreateBusAppGroups("<NAME_OF_BUSINESS_APP>"): Produces VM/DB group(s) for named Business Application
 */

/*
 * Print usage
 */
 console.log("")
 console.log("**** USAGE ****")
 console.log("  CreateBusAppGroups(\"scoped\"): Produces VM/DB group(s) for Business Application currently scoped in the Turbo UI view.")
 console.log("  CreateBusAppGroups(\"all\"): Produces VM/DB groups for ALL Business Applications known by the Turbo instance.")
 console.log("  CreateBusAppGroups(\"<NAME_OF_BUSINESS_APP>\"): Produces VM/DB group(s) for named Business Application.")
 console.log("")


async function CreateBusAppGroups(param) {
	if ((param == null) || (param == "") || (param == "scoped")) {
		var thisurl = document.URL;
		/* console.log("URL: "+thisurl); */
		var url_array = thisurl.split('/');
		var scope_id = url_array[url_array.length-1];
		/* console.log("SCOPE ID: "+scope_id); */
		console.log("Building VM/DB group for Business Application in current scoped view.")
		BuildBusAppGroup(scope_id)
		
	} else if (param == "all") {
		console.log("Creating VM/DB groups for each Business Application found in this Turbo instance.")
		busappslist = await getBusAppsList()
		if (busappslist.length > 0) {
			for (i = 0; i < busappslist.length; i++) {
				item = busappslist[i]
				await BuildBusAppGroup(item.uuid)
				console.log("")
			}
		} else {
			console.log("No Business Applications Found.")
		}

	} else {
		busappname = param
		busapp_uuid = await getUuid("BusApp", busappname) 
		if (busapp_uuid) {
			console.log("Building VM/DB group for Business Application, "+busappname) 
			await BuildBusAppGroup(busapp_uuid)
		} else {
			console.log("NOT FOUND: Business App, "+busappname)
		}
	}
}

async function BuildBusAppGroup(scope_id) {
	var ba_name = "BA NAME NOT FOUND"
	var ba_vms = []
	var ba_dbs = []
	const group_name_keyword = "BusApp"

	busappinfo = await getBusAppInfo(scope_id)
	if (busappinfo.length > 0) {
		busappinfo.forEach(function (item, index) {
			if (item.className == "BusinessApplication") {
				ba_name = item.displayName
			} else if (item.className == "VirtualMachine") {
				ba_vms.push(item.uuid)
			} else if (item.className == "DatabaseServer") {
				ba_dbs.push(item.uuid)
			}
		})
	} else {
		console.log("No data found for Business Application with UUID: "+scope_id)
	}

	console.log("Business Application Name: "+ba_name)
	console.log("VMs in Bus App: " + ((ba_vms.length > 0) ? ba_vms : "NONE FOUND"))
	console.log("DB Servers in Bus App: " + ((ba_dbs.length > 0) ? ba_dbs : "NONE FOUND"))
	
	group_url = '/vmturbo/rest/groups'
	/*group_url = '/api/v2/groups'*/
	/*search_url = '/api/v2/search?q='*/

	/* Did we find any VMs in the Bus app? */
	if (ba_vms.length > 0) {
		group_name = group_name_keyword+"_VMs_"+ba_name
		vms_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": ba_vms,
			"criteriaList": [],
			"groupType": "VirtualMachine"
		}
		
		/* Either create a new group of Bus App VMs or update the existing group if it already exists. */
		group_uuid = await getUuid("Group", group_name)
		if (group_uuid) {
			/* Found an existing group, so update it. */
			await CreateUpdate_Group(group_url+"/"+group_uuid, 'PUT', vms_group_body) 
			console.log("Updated VM Group: "+group_name)
		} else {
			/* Create a new group */
			await CreateUpdate_Group(group_url, 'POST', vms_group_body) 
			console.log("Created VM Group: "+group_name)
		}
	}

	/* Did we find any DB servers in the Bus app? */
	if (ba_dbs.length > 0) {
		group_name = group_name_keyword+"_DBs_"+ba_name

		dbs_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": ba_dbs,
			"criteriaList": [],
			"groupType": "DatabaseServer"
		}
		
		/* Either create a new group of Bus App VMs or update the existing group if it already exists. */
		group_uuid = await getUuid("Group", group_name)
		if (group_uuid) {
			/* Found an existing group, so update it. */
			await CreateUpdate_Group(group_url+"/"+group_uuid, 'PUT', dbs_group_body) 
			console.log("Updated DB Group: "+group_name)
		} else {
			/* Create a new group */
			await CreateUpdate_Group(group_url, 'POST', dbs_group_body) 
			console.log("Created DB Group: "+group_name)
		}
	}
} 

async function CreateUpdate_Group(group_url, api_method, body) {
	
	response = await fetch(group_url, {
		method: api_method,
		body: JSON.stringify(body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
} 

/* Looks at current UI page and grabs the scope ID */
async function getBusAppInfo(scope_id) {
	response = await fetch('/vmturbo/rest/search/?q=&scopes='+scope_id)
	return await response.json()
}

/* Returns search list of Business Applications */
async function getBusAppsList() {
	/*search_url = '/api/v2/search?types=BusinessApplication'*/
	search_url = '/vmturbo/rest/search?types=BusinessApplication'
	response = await fetch(search_url)
	return await response.json()
}

/* Returns UUID for named entity of given type */
async function getUuid(entity_type, entity_name) {
	if (entity_type == "BusApp") {
		filterType = "busAppsByName"
		className = "BusinessApplication"
	} else if (entity_type == "Group") {
		filterType = "groupsByName"
		className = "Group"
	} else {
		console.log("getUuid: Called with incorrect entity_type")
		return 0
	}
	
	entity_name = regExpEscape(entity_name)

	search_body = {
			"criteriaList": [
				{
					"expType": "RXEQ",
					"expVal": "^"+entity_name+"$",  /* need to limit to exact name match only so anchor the name */
					"filterType": filterType,
					"caseSensitive": true 
				}
				],
				"logicalOperator": "AND",
				"className": className,
				"scope": null
	}
	response = await fetch('/vmturbo/rest/search', {
		method: 'POST',
		body: JSON.stringify(search_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
	info =  await response.json()
	if (info.length > 0) {
		/* Found an existing entity so return uuid */
		return info[0].uuid
	}
}

function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

