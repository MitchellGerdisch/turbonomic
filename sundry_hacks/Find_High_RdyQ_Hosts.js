/*
 * Description:
 * Finds VMs with high CPU Ready Queue over the recent past.
 * 
 * Usage:
 *   - Copy paste the contents of this file into a Chrome javascript console.
 *   - At the Chome javascript console prompt enter "findHighRdyqVMs()"
 *   - Wait for the processing to complete and a list of VM names and related data to be presented.
 *     The most interesting examples should be at the bottom of the list.
 */
async function findHighRdyqVMs() { 
	
	console.log("Search for high ready queue VMs has started ...")
	/*
	 * Get all the on-prem VMs.
	 * A later enhancement may allow one to scope the search.
	 */
	onprem_vms = await getVMs()
	
	if (onprem_vms.length == 0) {
		console.log("No on premise VMs found. Exiting.")
		return
	}
	
	console.log("Found "+onprem_vms.length+" on premise VMs. Scanning their ready queue histories ...")

	
	/* Walk through the list of found VMs and do the following:
	 * - Get the VM's UUID
	 * - Figure out the CPU ReadyQ it uses (based on the number of vCPUs the VM has)
	 * - Find the max average RdyQ over the past X days.
	 */
	
	/* 
	 * Currently set to look over the last 7 days. 
	 */ 
	days_back = 7
	milliseconds_per_day = 86400*1000
	milliseconds_in_the_past = milliseconds_per_day * days_back
	end_time = Date.now()
	start_time = end_time - milliseconds_in_the_past
	
	/*
	 * We'll store the vm name and rdy q utilization info in an array
	 */
	vm_rdyq_info = []
	
	for (i = 0; i < onprem_vms.length; i++) { 
		onprem_vm = onprem_vms[i]
		
		/* To help the signal-to-noise ratio, we only bother looking at VMs that have a bit of severity to them. */
		if ((onprem_vm.severity == "Critical")||(onprem_vm.severity == "Major") || (onprem_vm.severity == "Minor")) {
			vm_name = onprem_vm.displayName
			vm_uuid = onprem_vm.uuid
			vm_cpunum = onprem_vm.aspects.virtualMachineAspect.numVCPUs
			vm_rdyq_type = "Q"+vm_cpunum+"VCPU"
			
			/* 
			 * Now for each VM, get the highest RdyQ utilization over the past X days.
			 */
			vm_high_rdyq = await get_High_RdyQ(vm_uuid, vm_rdyq_type, start_time, end_time)
	
			/* See: https://communities.vmware.com/docs/DOC-11494
			 * The RdyQ utilization is divided by the number of CPUs to get the normalized value.
			 */
			norm_rdyq = Math.round(vm_high_rdyq/vm_cpunum)
			
			/* Store the info for interesting examples which I'm defining as those cases where the normalized number is greater than 4 */
			if (norm_rdyq > 4) {
				vm_rdyq_info.push({
					"name":vm_name,
					"rdyq":vm_rdyq_type,
					"high_rdyq":vm_high_rdyq,
					"norm_rdyq":norm_rdyq
				})
			}
		}
	}
	
	sorted_rdyq_info = _.sortBy(vm_rdyq_info, 'norm_rdyq')
	
	console.log("Here are VMs with interesting ready queue histories:")
	for (k = 0; k < sorted_rdyq_info.length; k++) {
		rdyq_item = sorted_rdyq_info[k]
		console.log("VM Name: "+rdyq_item.name+"; RdyQ: "+rdyq_item.rdyq+"; High RdyQ: "+rdyq_item.high_rdyq+"; Normalized RdyQ: "+rdyq_item.norm_rdyq)
	}
	
}

async function get_High_RdyQ(vm_uuid, vm_rdyq_type, start_time, end_time) {
	request_body = {
			"statistics":[{"name":vm_rdyq_type}],
			"startDate":start_time,
			"endDate":end_time
	}

	response = await fetch("/vmturbo/rest/stats/" + vm_uuid + "?disable_hateoas=true", {
		method: 'POST',
		body: JSON.stringify(request_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
	rdyq_stats = await response.json()
	
	highest_rdyq_util = 0
	for (j = 0; j < rdyq_stats.length; j++) {
		rdyq_stat = rdyq_stats[j]
		rdyq_capacity = rdyq_stat.statistics[0].capacity.avg
		rdyq_value = rdyq_stat.statistics[0].value
		rdyq_util = Math.round((rdyq_value/rdyq_capacity)*100)
		if (rdyq_util > highest_rdyq_util) {
			highest_rdyq_util = rdyq_util
		}
	}

	return highest_rdyq_util
}

/* 
 * Returns list of on prem VMs with severity of Major or Critical 
 * This is done to allow the processing to focus on what should be useful examples.
 */
async function getVMs() {
	request_body = {
			"criteriaList": [],
			"logicalOperator": "AND",
			"className": "VirtualMachine",
			"environmentType": "ONPREM",
			"scope": null
	}
	response = await fetch('/vmturbo/rest/search/?ascending=false&disable_hateoas=true&order_by=severity&q=', {
		method: 'POST',
		body: JSON.stringify(request_body),
		headers: {
			'Content-Type': 'application/json'
		}
	})
	return await response.json()	
}


