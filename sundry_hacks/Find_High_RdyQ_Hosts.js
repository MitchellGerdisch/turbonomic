Walk through VMs
- scoped to on-prem
- further scoping parameter?
Look at capacity and usage stats for each VM and find which readyQ it uses
Look at 30 days? 7 days? 24 hours? of the identified readyQ and look for the largest number and report that number

/*
 * Find high CPU ReadyQ VMs.
 */
async function FindHighRdyQ(param) {
	if ((param == null) || (param == "")) { 
		/* go through all on-premise VMs */
		vm_rdyq_types = await getVM_rdyQ_types()
		console.log("******")
		console.log(JSON.stringify(vm_rdyq_types))
		console.log("*****")
	} 
/* else if (param == "all") {
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
*/
}

async function findHighRdyqVMs() {
	/*
	 * Get all the on-prem VMs.
	 * A later enhancement may allow one to scope the search.
	 */
	onprem_vms = await getOnpremVMs()

	
	/* Walk through the list of found VMs and do the following:
	 * - Get the VM's UUID
	 * - Figure out the CPU ReadyQ it uses (based on the number of vCPUs the VM has)
	 * - Find the max average RdyQ over the past X days.
	 */
	
	/* 
	 * Currently set to look over the last 7 days. 
	 */ 
	days_back = 3
	/*days_back = 7*/
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
	
	sorted_rdyq_info = _.sortBy(vm_rdyq_info, 'norm_rdyq')
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

/* Returns list of on prem VMs */
async function getOnpremVMs() {
	request_body = {
			"criteriaList": [],
			"logicalOperator": "AND",
			"className": "VirtualMachine",
			"environmentType": "ONPREM",
			"scope": null
	}
	response = await fetch('/vmturbo/rest/search', {
		method: 'POST',
		body: JSON.stringify(request_body),
		headers: {
			'Content-Type': 'application/json'
		}
	})
	return await response.json()	
}


