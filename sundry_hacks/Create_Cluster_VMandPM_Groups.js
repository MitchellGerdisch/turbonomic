/*
 * WHAT IT DOES
 * Useful with XL version of Turbo since cluster PM and VM groups are not automatically created.
 * For each cluster found on the instance, the script will create two groups:
 * - PMs_Cluster_<CLUSTER NAME>: A group containing the hosts of the given cluster.
 * - VMs_Cluster_<CLUSTER NAME>: A group containing the VMs of the given cluster.
 * 
 * HOW TO USE
 * Copy the script into Chrome Javascript console.
 * It will autorun.
 */



/* Autorun the script */
CreateClusterGroups()

async function CreateClusterGroups(param) {
	console.log("Creating VM/PM groups for each Cluster found in this Turbo instance.")
	clusterslist = await getClustersList()
	if (clusterslist.length > 0) {
		for (a = 0; a < clusterslist.length; a++) {
			item = clusterslist[a]
			await buildClusterGroups(item.displayName, item.uuid)
			console.log("")
		}
	} else {
		console.log("No Clusters Found.")
	}
}

async function buildClusterGroups(cluster_name, cluster_uuid) {
	var cluster_vms = []
	var cluster_pms = []
	const group_name_keyword = "Cluster"
		
	cluster_pms = await getClusterEntities("PMs", cluster_uuid)
	cluster_vms = await getClusterEntities("VMs", cluster_uuid)

		
	console.log("Cluster Name: "+cluster_name)
	console.log("VMs in Cluster: " + ((cluster_vms.length > 0) ? cluster_vms : "NONE FOUND"))
	console.log("PMs in Cluster: " + ((cluster_pms.length > 0) ? cluster_pms : "NONE FOUND"))
	
	group_url = '/vmturbo/rest/groups'
	/*group_url = '/api/v2/groups'*/
	/*search_url = '/api/v2/search?q='*/

	/* Did we find any VMs in the cluster? */
	if (cluster_vms.length > 0) {
		group_name = "VMs_"+ group_name_keyword+"_"+cluster_name
		vms_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": cluster_vms,
			"criteriaList": [],
			"groupType": "VirtualMachine"
		}
		
		/* Either create a new group of Cluster VMs or update the existing group if it already exists. */
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

	/* Did we find any PMs in the Cluster? */
	if (cluster_pms.length > 0) {
		group_name = "PMs_"+group_name_keyword+"_"+cluster_name

		pms_group_body = {
			"isStatic": true,
			"displayName": group_name,
			"memberUuidList": cluster_pms,
			"criteriaList": [],
			"groupType": "PhysicalMachine"
		}
		
		/* Either create a new group of Cluster PMs or update the existing group if it already exists. */
		group_uuid = await getUuid("Group", group_name)
		if (group_uuid) {
			/* Found an existing group, so update it. */
			await CreateUpdate_Group(group_url+"/"+group_uuid, 'PUT', pms_group_body) 
			console.log("Updated PM Group: "+group_name)
		} else {
			/* Create a new group */
			await CreateUpdate_Group(group_url, 'POST', pms_group_body) 
			console.log("Created PM Group: "+group_name)
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

/* get list of UUIDs for given type of entity for given cluster */
async function getClusterEntities(entity_type, search_scope_uuid) {
	
	if (entity_type == "PMs") {
		class_name = "PhysicalMachine"
	} else if (entity_type == "VMs") {
		class_name = "VirtualMachine"
	} else {
		console.log("*** ERROR *** getClusterEntities called with wrong entity_type: " + entity_type)
		return
	}

	search_body = {
		"criteriaList": [],
		"logicalOperator": "AND",
		"className": class_name,
		"environmentType": "ONPREM",
		"scope": [
		   search_scope_uuid 
		]
	}	
	response = await fetch('/vmturbo/rest/search/?q=', {
		method: 'POST',
		body: JSON.stringify(search_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})

	cluster_entities = await response.json()
	
	entity_uuids = []
	for (i = 0; i < cluster_entities.length; i++) {
		entity_uuids.push(cluster_entities[i].uuid)
	}
	return entity_uuids
}

/* Returns search list of Business Applications */
async function getClustersList() {
	/*search_url = '/api/v2/search?types=BusinessApplication'*/
	search_url = '/vmturbo/rest/search?types=Cluster'
	response = await fetch(search_url)
	clusters = await response.json()
	return clusters
}

/* Returns UUID for named entity of given type */
async function getUuid(entity_type, entity_name) {
	if (entity_type == "BusApp") {
		filterType = "busAppsByName"
		className = "BusinessApplication"
	} else if (entity_type == "Group") {
		filterType = "groupsByName"
		className = "Group"
	} else if (entity_type == "Cluster") {
		filterType = "clustersByName"
		className = "Cluster"
	} else {
		console.log("getUuid: Called with incorrect entity_type")
		return 0
	}

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

