/*
 * WHAT IT DOES
 * Useful with XL version of Turbo since it's harder to find and identify cloud instances with and without memory metrics enabled.
 * Creates two groups and downloads analogous CSV files:
 * - VMs_Memory_Metrics_Enabled
 * - VMs_Memory_Metrics_Not_Enabled
 * 
 * HOW TO USE
 * Copy the script into Chrome Javascript console.
 * It will autorun.
 * 
 * FUTURE
 * Maybe groups for each cloud account?
 */

/* Autorun the script */
CreateMemMetricsGroups()

async function CreateMemMetricsGroups() {
	console.log("Creating VM groups for instances with and without memory metrics enabled."
	instances = await getInstances()
	if (instances.length > 0) {
		for (a = 0; a < clusterslist.length; a++) {
			item = clusterslist[a]
			/*
			await buildClusterGroups(item.displayName, item.uuid)
			*/
			console.log("")
		}
	} else {
		console.log("No cloud instances found.")
	}
}

async function getInstances() {
	
	/* API defaults to 500 max elements - so use cursor attribute, if needed, to call API multiple times to get all the instances. */
	all_instances = []
	cursor = 0
	looking_for_instances = true
	while (looking_for_instances) {
		uri = '/api/v3/markets/'+market+'/actions?cursor='+cursor
		action_fetch = await fetch(uri, {
			method: 'POST',
			body: JSON.stringify(actions_body),
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
		actions = await action_fetch.json()	
		if (actions.length > 0) {
			cursor = cursor + actions.length 
			all_actions = all_actions.concat(actions)
		} else {
			looking_for_actions = false
		}
	}
	
	
	
	
	
	
API call to get memory stats
Request URL: https://xl1.demo.turbonomic.com/vmturbo/rest/stats/?ascending=false&disable_hateoas=true&limit=50&order_by=VMem
	body: {"scopes":["284560650706242"],"period":{"statistics":[{"name":"VMem"},{"name":"costPrice"}]},"relatedType":"VirtualMachine"}

Response:
	with mem metrics: NOTE the VMem section VALUES have numbers > 0
	{
	    "uuid": "73454410482404",
	    "displayName": "AppDTurboAJNv3",
	    "className": "VirtualMachine",
	    "environmentType": "CLOUD",
	    "stats": [
	      {
	        "date": "2020-06-10T20:51:25Z",
	        "statistics": [
	          {
	            "name": "costPrice",
	            "relatedEntityType": "VirtualMachine",
	            "filters": [
	              {
	                "type": "costComponent",
	                "value": "ON_DEMAND_COMPUTE"
	              }
	            ],
	            "units": "$/h",
	            "values": {
	              "max": 0.146,
	              "min": 0.004,
	              "avg": 0.08584453,
	              "total": 0.2575336
	            },
	            "value": 0.08584453
	          },
	          {
	            "name": "VMem",
	            "capacity": {
	              "max": 7340032.0,
	              "min": 7340032.0,
	              "avg": 7340032.0,
	              "total": 7340032.0,
	              "totalMax": 7340032.0,
	              "totalMin": 7340032.0
	            },
	            "reserved": {
	              "max": 0.0,
	              "min": 0.0,
	              "avg": 0.0,
	              "total": 0.0
	            },
	            "filters": [
	              {
	                "type": "relation",
	                "value": "sold"
	              }
	            ],
	            "units": "KB",
	            "values": {
	              "max": 7076864.0,
	              "min": 7068262.5,
	              "avg": 7068262.5,
	              "total": 7068262.5,
	              "totalMax": 7076864.0,
	              "totalMin": 7068262.5
	            },
	            "value": 7068262.5
	          }
	        ],
	        "epoch": "HISTORICAL"
	      }
	    ]
	  },
	
	
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

