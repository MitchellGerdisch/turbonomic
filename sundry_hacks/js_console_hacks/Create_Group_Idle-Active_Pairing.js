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
 * Cluster where Idle VMs are found - This will be the cluster that the active VMs will be added to in the plan. It's the cluster used to find idle VMs.
 * NOTE: Currently, this should be a simple regular expression that does not have any slashes or other special characters (e.g. ".*ACME RHEL.*")
 * 
 * OUTPUT
 * Creates a regexp that should be used to create a group of VMs on the cluster with the active counterparts.
 * 
 * TO-DO:
 * Not all customers use a same-name approach. Some have a naming convention where the majority of the VMs' names are similar but 
 * there's some special character to represent "active" vs "backup" VM. So some way of telling the script this naming convention could be used.
 * Also just being nicer and create the group
 */

 console.log("")
 console.log("**** USAGE ****")
 console.log("  CreateAddMachineGroup(\"<IDLE_VMS_CLUSTER>\"")
 console.log("")

 async function CreateAddMachineGroup(idle_vms_cluster) {
	 if ((idle_vms_cluster == null) || (idle_vms_cluster== "")) {
		 console.log("**** Need to pass name of cluster where to look for Idle VMs.") 
		 console.log("USAGE: CreateAddMachineGroup(\"<IDLE_VMS_CLUSTER>\"")
		 return
	 }
	 /*
	  * Go find idle VMs 
	  */
	 idle_vms = await getVms("IDLE", idle_vms_cluster)
	 
	 group_search_regexp = buildGroupSearchRegexp(idle_vms)
	 
	 console.log("USE THIS REG EXP TO CREATE GROUP OF VMS ON CLUSTER WITH ACTIVE COUNTERPARTS")
	 console.log(group_search_regexp)

	 
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
 
 function buildGroupSearchRegexp(vms) {
	 
	regexp = ""
	for (v = 0; v < vms.length; v++) {
		
		vm_name = vms[v].displayName
		
		if (regexp) {
			regexp = regexp + "|" + "^"+vm_name+"$"
		} else {
			regexp = "^"+vm_name+"$"
		}
	} 
	
	return regexp
 }
 
 async function getVms(state, cluster) {
	 
	 request_body = {
			 "criteriaList": [{
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
		 	}],
		 	"logicalOperator": "AND",
		 	"className": "VirtualMachine",
		 	"scope": null
	}
	 
	 response = await fetch('/vmturbo/rest/search/?ascending=true&order_by=name', {
	 	 method: 'POST',
	 	 body: JSON.stringify(request_body),
	 	 headers: {
	 		  'Content-Type': 'application/json'
	 	 }
	 })
	 return await response.json() 
} 
 
