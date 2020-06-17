/*
 * WHAT IT DOES
 * Customers often have idle VMs that map to active VMs for active/standby or SRM architectures.
 * This script looks through a given cluster for idle VMs and then looks through another cluster for corresponding active VMs 
 * and creates a group of those active VMs and the idle VMs.
 * The active VMs group can then be used in add machine plans to test whether or not the cluster running the idle VMs can handle the
 * load of running them if they were activated.
 * 
 * SPECIAL CASE HANDLING
 * If the found idle VM has no corresponding active VM, it'll be noted in the script's output but otherwise ignored.
 * 
 * INPUTS
 * Cluster to Test - This will be the cluster that the active VMs will be added to in the plan. It's the cluster used to find idle VMs.
 * Active VM Cluster - The cluster to look for corresponding active VMs on.
 * 
 * OUTPUT
 * Creates a group of active VMs that is used for adding to the Idle cluster in plans.
 * 
 * TO-DO:
 * Not all customers use a same-name approach. Some have a naming convention where the majority of the VMs' names are similar but 
 * there's some special character to represent "active" vs "backup" VM. So some way of telling the script this naming convention could be used.
 */

 console.log("")
 console.log("**** USAGE ****")
 console.log("  CreateAddMachineGroup(\"<CLUSTER_TO_TEST>\", \"<ACTIVE_VMS_CLUSTER>\"")
 console.log("")

 async function CreateAddMachineGroup(cluster_to_test, active_vms_cluster) {
	 if ((cluster_to_test == null) || (cluster_to_test == "")) {
		 console.log("**** Need to pass name of cluster where to look for Idle VMs.") 
		 console.log("**** USAGE: CreateAddMachineGroup(\"<CLUSTER_TO_TEST>\", \"<ACTIVE_VMS_CLUSTER>\"")
		 return
	 }
	 if ((active_vms_cluster == null) || (active_vms_cluster == "")) {
		 console.log("**** Need name of cluster where to look for corresponding active VMs.")
		 console.log("**** USAGE: CreateAddMachineGroup(\"<CLUSTER_TO_TEST>\", \"<ACTIVE_VMS_CLUSTER>\"")
		 return
	 }
	 
	 /*
	  * Go find idle VMs on cluster_to_test.
	  */
	 idle_vms = getVms("IDLE", cluster_to_test)
	 
	 console.log(JSON.stringify(idle_vms))
	 
	 
	 /*
	  * Go find corresponding active VMs, if any.
	  */
	 active_vms = getVms("ACTIVE", active_vms_cluster)

	 
	 /*
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
	*/
}
 
 async function getVms(state, cluster) {
	 cluster_id = getUuid("Cluster", cluster)
	
	 /*

	 request_body = {
  "criteriaList": [
    {
      "expType": "RXEQ",
      "expVal": cluster,
      "filterType": "vmsByClusterName",
      "caseSensitive": true
    },
    {
      "expType": "EQ",
      "expVal": state,
      "filterType": "vmsByState",
      "caseSensitive": true
    }
  ],
  "logicalOperator": "AND",
  "className": "VirtualMachine",
  "scope": null
}
*/
	 
	 request_body = {
			  "criteriaList": [
				    {
				      "expType": "RXEQ",
				      "expVal": "HawthorneSales\\SEDEMO (Intel)",
				      "filterType": "vmsByClusterName",
				      "caseSensitive": true
				    },
				    {
				      "expType": "EQ",
				      "expVal": "IDLE",
				      "filterType": "vmsByState",
				      "caseSensitive": true
				    }
				  ],
				  "logicalOperator": "AND",
				  "className": "VirtualMachine",
				  "scope": null
				}
	 
	 /*
	 
	 request_body = {
			 "criteriaList": [{
				 "expType": "EQ",
				 "expVal": state,
				 "filterType": "vmsByState",
				 "caseSensitive": true
			 }],
			 "logicalOperator": "AND",
			 "className": "VirtualMachine",
			 "environmentType": "ONPREM",
			 "scope": [ cluster ]
	 }
	 */
	 
	 console.log("### DEBUG - get vms search: "+JSON.stringify(request_body))
	 
	 response = await fetch('/vmturbo/rest/search/?ascending=false&disable_hateoas=true&order_by=severity&q=', {
	 	 method: 'POST',
	 	 body: JSON.stringify(request_body),
	 	 headers: {
	 		  'Content-Type': 'application/json'
	 	 }
	 })
	 return await response.json() 
} 
 
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


############
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

function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

