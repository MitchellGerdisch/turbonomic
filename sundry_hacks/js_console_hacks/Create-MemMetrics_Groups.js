/* 
 * Builds groups of cloud instances with and without Memory Metrics enabled.
 * The existence of memory metrics is based on whether or not the memory utilization is 0% or not.
 * Also downloads two CSVs - one of VMs with memory metrics enabled and one of VMs without.
 */

/* Auto call the function to get things going */
CreateMemMetricsGroups()


async function CreateMemMetricsGroups() { 
	
	console.log("")
	console.log("**** Looking for instances with and without memory metrics enabled ... this may take a few minutes ...")
	console.log("")
	
	/* get an array of cloud account uuids to use for getting the VM stats */
	cloud_account_ids = await getUuids("BusinessAccount")

	console.log("... found "+cloud_account_ids.length+" cloud accounts ...")
	console.log("... processing VMs' memory metrics ...") 
		
	instance_mem_stats = await getInstanceMemStats(cloud_account_ids)
	
	if (instance_mem_stats.length == 0) {
		console.log("*** Something is not working. The API did not return any data.")
		return
	}
	
	/* 
	 * Build array of all idle instance uuids to check against while building the groups.
	 * This is needed because idle instances will have mem stat of 0 - it's idle after all.
	 * So we don't want to put idle instances in either group since we don't know. 
	 */
	idle_instances = await getIdleCloudInstances(cloud_account_ids)
	
	/*
	 * Now go through the stats and separate the instances with memory metrics enabled - as identified by a non-zero memory stat,
	 * from those without memory metrics enabled.
	 * Idle instances are unknown.
	 */
	csvContentMemMetricsUnknown = "data:text/csv;charset=utf-8,";
	csvContentMemMetricsUnknown += "Instance Name,Instance ID\n"
	csvContentMemMetricsEnabled = "data:text/csv;charset=utf-8,";
	csvContentMemMetricsEnabled += "Instance Name,Instance ID\n"
	csvContentMemMetricsDisabled = "data:text/csv;charset=utf-8,";
	csvContentMemMetricsDisabled += "Instance Name,Instance ID\n"
	mem_metric_unknown = []	
	mem_metric_enabled = []
	mem_metric_disabled = []
	for (m = 0; m < instance_mem_stats.length; m++) {
		instance_mem_stat = instance_mem_stats[m]
		uuid = instance_mem_stat.uuid
		name = instance_mem_stat.displayName
		if (idle_instances.includes(uuid)) {
			csvContentMemMetricsUnknown += name + "," + uuid + "\n"
			mem_metric_unknown.push(uuid)
		} else {
			instance_mem_util = getInstanceMemUtil(instance_mem_stat)
			if (instance_mem_util > 0) {
				csvContentMemMetricsEnabled += name + "," + uuid + "\n"
				mem_metric_enabled.push(uuid)
			} else {
				csvContentMemMetricsDisabled += name + "," + uuid + "\n"
				mem_metric_disabled.push(uuid)
			}
		}
	}

	/* Create/update groups */
	await upsertStaticGroup("VMs_Memory_Metrics_Unknown", mem_metric_unknown)
	await upsertStaticGroup("VMs_Memory_Metrics_Enabled", mem_metric_enabled)
	await upsertStaticGroup("VMs_Memory_Metrics_Disabled", mem_metric_disabled)

	
	/* Create and download CSVs of the VMs in each group */
	console.log("*** Downloading CSVs containing instances with and without memory metrics as well as unknown (i.e. idle).")
	link = document.createElement('a')
	link.setAttribute('href', encodeURI(csvContentMemMetricsUnknown));
	link.setAttribute('download', `turbonomic_MemMetricsUnknown_${(new Date()).getTime()}.csv`);
	link.click()
	link = document.createElement('a')
	link.setAttribute('href', encodeURI(csvContentMemMetricsEnabled));
	link.setAttribute('download', `turbonomic_MemMetricsEnabled_${(new Date()).getTime()}.csv`);
	link.click()
	link = document.createElement('a')
	link.setAttribute('href', encodeURI(csvContentMemMetricsDisabled));
	link.setAttribute('download', `turbonomic_MemMetricsDisabled_${(new Date()).getTime()}.csv`);
	link.click()
}

/* Returns an array of VMem stats for all the cloud instances */
async function getInstanceMemStats(cloudAccountIds) {
	
	base_uri = "/api/v3/stats"
	body = {
			"scopes":cloudAccountIds,
			"period":{
				"statistics":[
					{"name":"VMem"}
				]
			},
			"relatedType":"VirtualMachine"
	}
	
	all_stats = await getAllResponses(base_uri, body, "POST")
	
	return all_stats
}

function getInstanceMemUtil(item) {
	
	stats = item.stats[0].statistics
	
	for (s = 0; s < stats.length; s++) {
		stat = stats[s]
		if (stat.name == "VMem") {
			return stat.values.avg
		}
	}
}


/*
 * Returns an array of all the UUIDs of the given type.
 * You can see the type by going to Search in the UI and selecting a given category.
 * For example, Accounts (i.e. Cloud Accounts) are type == BusinessAccount.
 */
async function getUuids(type) {
	uri = "/vmturbo/rest/search?disable_hateoas=true&q=&types="+type	
	response = await fetch(uri, {
			method: 'GET',
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
	
	type_search_results = await getAllResponses(uri, {}, "GET")
	
	if (type_search_results.length == 0) {
		console.log("No items of type, "+type+" found. Exiting.")
		return
	}
	console.log("Found "+type_search_results.length+" items of type, "+type+".")
	item_ids = type_search_results.map(type_search_result => type_search_result.uuid)

	return(item_ids)
}

async function getIdleCloudInstances(account_list) {
	accounts_regexp = account_list[0]
	for (a = 1; a < account_list.length; a++) {
		accounts_regexp = accounts_regexp + "|"+account_list[a]
	}
	
	base_uri = "/vmturbo/rest/search/?ascending=false&aspect_names=cloudAspect&disable_hateoas=true&order_by=severity&q="
	body = {
		  "criteriaList": [
		    {
		      "expType": "EQ",
		      "expVal": "IDLE",
		      "filterType": "vmsByState",
		      "caseSensitive": false
		    },
		    {
		        "expType": "EQ",
		        "expVal": accounts_regexp,
		        "filterType": "vmsByBusinessAccountUuid",
		        "caseSensitive": false
		      }
		  ],
		  "logicalOperator": "AND",
		  "className": "VirtualMachine",
		  "scope": null
		}
	
	idle_instances = await getAllResponses(base_uri, body, "POST")
	
	if (idle_instances.length == 0) {
		console.log("*** No Idle instances found")
		return []
	}

	idle_instance_ids = idle_instances.map(idle_instance => idle_instance.uuid)
	
	return idle_instance_ids
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
