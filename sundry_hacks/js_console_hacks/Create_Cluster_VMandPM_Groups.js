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
			if (clusterslist[a].displayName) {
				item = clusterslist[a]
				await buildClusterGroups(item.displayName, item.uuid)
				console.log("")
			}
		}
	} else {
		console.log("No Clusters Found.")
	}
}

async function buildClusterGroups(cluster_name, cluster_uuid) {
	console.log("Cluster Name: "+cluster_name)
	const group_name_keyword = "Cluster"
	var group_name
	var filter_type
	var group_type

	/* Build Cluster VM group */
	group_name = "VMs_"+ group_name_keyword+"_"+cluster_name
	filter_type = "vmsByClusterName"
	group_type = "VirtualMachine"
	await CreateUpdate_Group(cluster_name, group_name, filter_type, group_type) 
	
	/* Build Cluster host group */
	group_name = "PMs_"+group_name_keyword+"_"+cluster_name
	filter_type = "pmsByClusterName"
	group_type = "PhysicalMachine"
	await CreateUpdate_Group(cluster_name, group_name, filter_type, group_type) 
} 

async function CreateUpdate_Group(cluster_name, group_name, filter_type, group_type) {
	console.log("Group, "+group_name+" ...")
	var group_url = '/vmturbo/rest/groups'
	var api_method = "POST"
	/* Check if the group already exists and if so, make this an update instead of a create */
	group_uuid = await getUuid("Group", group_name)
	if (group_uuid) {
		/* Found an existing group, so update it. */
		group_url = group_url+"/"+group_uuid
		api_method = 'PUT'
	}
	
	cluster_name = regExpEscape(cluster_name)

	/* Create a dynamic group based on the cluster name */
	var group_body = {
		"isStatic": false,
		"displayName": group_name,
		"memberUuidList": [],
		"criteriaList": [{
			"expType": "RXEQ",
			"expVal": "^"+cluster_name+"$",
			"filterType": filter_type,
			"caseSensitive": false
		}],
		"groupType": group_type
	}
	
	response = await fetch(group_url, {
		method: api_method,
		body: JSON.stringify(group_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
	
	console.log((group_uuid ? "... updated." : "... created."))
} 

/* Returns search list of Clusters. */
async function getClustersList() {
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

