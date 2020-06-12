/*
 * NAME: Create_Business_Application_VMandDB_Groups_Classic
 * 
 * CAVEATS: 
 * 	This script ONLY works for Business Applications.
 *  You may see a 400 error when running the script. If the script outputs a message that you can ignore the 400 error, then do just that.
 * 
 * How to Use:
 * First, copy the script into Chrome Javascript console.
 * Then you have two ways of running the script:
 * 1) Enter "CreateBusAppGroups("all") to create VM and/or DB server groups for every Business Application.
 *    Note: You do NOT need to be in a scoped view for this command.
 * 2) Enter "CreateBusAppGroups("<BUSINESS_APP_NAME>") to create VM and/or DB server groups for the given, named Business Application.
 *    Note: You do NOT need to be in a scoped view for this command.
 * 
 * 
 * What it Produces:
 * Up to two groups for the Business Application with a naming convention as follows:
 * - BusApp_VMs_<BUSINESS APP NAME>: A group that contains the VMs for that scoped view, assuming there are some.
 * - BusApp_DBs_<BUSINESS APP NAME>: A group that contains the DB servers for that scoped view, assuming there are some.
 */

/*
 * Print usage
 */
 console.log("")
 console.log("**** USAGE ****")
 console.log("CreateBusAppGroups(\"all\"): Produces VM/DB groups for ALL Business Applications known by the Turbo instance.")
 console.log("CreateBusAppGroups(\"<NAME_OF_BUSINESS_APP>\"): Produces VM/DB group(s) for named Business Application.")
 console.log("")


async function CreateBusAppGroups(param) {
	if (param == "all") {
		console.log("Creating VM/DB groups for each Business Application found in this Turbo instance.")
		busappslist = await getBusAppsList()
		if (busappslist.length > 0) {
			for (i = 0; i < busappslist.length; i++) {
				item = busappslist[i]
				await BuildBusAppGroup(item.displayName, item.uuid)
				console.log("")
			}
			console.log("")
			console.log("*** DONE ***")
		} else {
			console.log("No Business Applications Found.")
		}

	} else {
		busappname = param
		busapp_uuid = await getUuid("BusApp", busappname) 
		if (busapp_uuid) {
			console.log("Building VM/DB group for Business Application, "+busappname) 
			await BuildBusAppGroup(busappname, busapp_uuid)
			console.log("")
			console.log("*** DONE ***")
		} else {
			console.log("NOT FOUND: Business App, "+busappname)
		}
	}
}

async function BuildBusAppGroup(ba_name, busapp_uuid) {
	const group_name_keyword = "BusApp"
	console.log("*** Business Application Name: "+ba_name)

	var ba_vms = await getBusAppElements("VM",busapp_uuid)
	console.log("VMs in Bus App: " + ((ba_vms.length > 0) ? ba_vms : "NONE FOUND"))

	var ba_dbs = await getBusAppElements("DB",busapp_uuid)
	console.log("DB Servers in Bus App: " + ((ba_dbs.length > 0) ? ba_dbs : "NONE FOUND"))
	
	group_url = '/vmturbo/rest/groups'
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
	
/* Returns search list of Business Applications */
async function getBusAppsList() {
	/*search_url = '/api/v2/search?types=BusinessApplication'*/
	search_url = '/vmturbo/rest/search?types=BusinessApplication'
	response = await fetch(search_url)
	return await response.json()
}

/*
 * Turbo may return a 400 if the given business app doesn't have any elements of the given type.
 * For example, a business app with no DB servers will cause a 400 error from Turbo.
 * This function catches the problem and continues processing.
 * BUT, the browser may show the 400 error and it should be ignored.
 * 
 * Returns an array of UUIDs of VMs or DBs associated with the UUID.
 */
async function getBusAppElements(element_type, uuid) {
	search_body = {
			"criteriaList": [],
			"logicalOperator": "AND",
			"className": (element_type == "DB" ? "DatabaseServer" : "VirtualMachine"), 
			"environmentType": "HYBRID",
			"scope": [uuid]
	}
	elements_info = []
	elements = []
	
	await fetch('/vmturbo/rest/search', {
		method: 'POST',
		body: JSON.stringify(search_body),
		headers: {
		'Content-Type': 'application/json'
		}
	})
	/* Check if we got anything back. */
	.then(function(response) {
			if (!response.ok) {
				console.log("(Don't fret. You can ignore the 400 error.)")
				throw Error("no elements found")
			}
			return response /* if the throw doesn't fire, forward the response to the success case processing */
	/* Process the success case */
	}).then(async function(response) {
			elements_info = await response.json()
			if (elements_info.length > 0) {
				elements_info.forEach(function (item, index) {
					elements.push(item.uuid) 
				})
			}
	})
	.catch(function(err) {
		/* do nothing */
	})
	return elements
} 

/* wrapper for API call to create or update a group */
async function CreateUpdate_Group(group_url, api_method, body) {
	
	response = await fetch(group_url, {
		method: api_method,
		body: JSON.stringify(body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
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
