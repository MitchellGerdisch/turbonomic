/*
 * NAME: Dynamic2Static_Group
 * 
 * USE-CASE
 * This script takes the members found for a dynamic group and creates a static group of those members.
 * This script will take that big ole OR-ed list of names and create a static group with  
 * 
 * How to Use:
 * 1) Copy the script into Chrome Javascript console.
 * 2) Enter Static2Dynamic_Group("DYNAMIC_GROUP_NAME")
 * 

/*
 * Print usage
 */
 console.log("")
 console.log("**** USAGE ****")
 console.log("Dynamic2Static_Group(\"NAME_OF_DYNAMIC_GROUP\")")
 console.log("")
 
async function Dynamic2Static_Group(dyngroup) {
	if (dyngroup == "") {
		console.log("*** ERROR *** No dynamic group name given")
		return
	}
	
	/*
	 * Get array of members' UUIDs for the dynamic group
	 */
	member_uuids = await getMembersUuids(dyngroup)
	
	/*
	 * Create/update static group of those members
	 */
	static_group_name = dyngroup+"_STATIC"
	await upsertStaticGroup(static_group_name, member_uuids)
	
}

async function upsertStaticGroup(group_name, member_list) {
	group_url = '/vmturbo/rest/groups'
	vms_group_body = {
		"isStatic": true,
		"displayName": group_name,
		"memberUuidList": member_list,
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

async function CreateUpdate_Group(group_url, api_method, body) {
	response = await fetch(group_url, {
		method: api_method,
		body: JSON.stringify(body),
    	headers: {
        	'Content-Type': 'application/json'
      	}
	})
}

async function getMembersUuids(dyngroup) {

	group_uuid = await getUuid("Group", dyngroup)

	uri = '/api/v3/groups/'+group_uuid+'/members'
		
	all_members = await getAllResponses(uri, {}, "GET")

	group_member_uuids = []
	group_member_ids = all_members.map(member => member.uuid)
	
	return group_member_ids
}

/*
 * Captures logic related to handling the API cursor for large API responses.
 */
async function getAllResponses(base_uri, body, method) {
	all_responses = []
	done = false
	uri = base_uri
	cursor_string = "?cursor="
	if (base_uri.includes("?")) {
		/* Then there's already parameters in the uri, so just add the cursor parameter if at all. */
		cursor_string = "&cursor="
	}
	var api_response 
	while (!done) {
		
		if (method == "GET") {
			api_response = await fetch(uri, {
				method: method,
				headers: {
					'Content-Type': 'application/json'
				}
			})
		} else {
			api_response = await fetch(uri, {
				method: method,
				body: JSON.stringify(body),
	    		headers: {
	        		'Content-Type': 'application/json'
	      		}
			})
		}
		responses = await api_response.json()	
		
		all_responses = all_responses.concat(responses)
		
		/* check if there are more to be gotten by checking the cursor header in the response */
		cursor = getCursor(api_response)
		if (cursor) {
			uri = base_uri + cursor_string + cursor
		} else {
			done = true
		}
	}
	
	return all_responses
}


/*
 * Returns the next cursor from the response if there is one.
 */
function getCursor(response) {
	cursor = ""
	for(let entry of response.headers.entries()) {
		if (entry[0] == "x-next-cursor") {
			cursor = entry[1]
		}
	}
	return cursor
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

