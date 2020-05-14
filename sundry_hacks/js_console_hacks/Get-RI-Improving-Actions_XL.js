/* 
 * Finds actions that improve RI utilization.
 */

/* Auto call the function to get things going */
getRIimprovingActions_xl()

async function getRIimprovingActions_xl() { 
	
	console.log("")
	console.log("**** Looking for RI-improving actions ... this may take a few minutes ...")
	console.log("")
	
	current_market = await getCurrentMarket()
	if (current_market == 0) {
		console.log("*** ERROR *** Something is not right. No market was found.") 
		return
	}
	
	ri_improving_actions = await findRiImprovingActions(current_market)
	
	if (ri_improving_actions.length == 0) {
		console.log("*** NO RI UTILIZATION IMPROVING ACTIONS FOUND. ***")
	} else {
		console.log("*** Found some RI utilization improving actions ...")

		csvContent = "data:text/csv;charset=utf-8,";
		csvContent += "Instance Name,Account Name,Instance ID,Current RI Utilization,New RI Utilization,Action,Reason\n" 
		
		for (i = 0; i < ri_improving_actions.length; i++) {
			ri_action = ri_improving_actions[i]
			instance = ri_action.instance_name
			instance_id = ri_action.instance_id
			account = ri_action.account_name
			current_ri = ri_action.current_ri_util
			new_ri = ri_action.new_ri_util
			action = ri_action.action
			reason = ri_action.reason
			
			console.log("Instance Name: "+ instance); 
			console.log("- Account Name: "+ account);
			console.log("- Instance ID: "+ instance_id);
			console.log("- Current RI Utilization: "+ current_ri);
			console.log("- New RI Utilization: " + new_ri);
			console.log("- Action: " + action);
			console.log("- Reason: " + reason);
			csvContent += instance + "," + account + "," + instance_id + "," + current_ri + "," + new_ri + "," + action + "," + reason + "\n"
		}

		console.log("*** Downloading CSV containing RI-improving actions.")
		link = document.createElement('a')
		link.setAttribute('href', encodeURI(csvContent));
		link.setAttribute('download', `turbonomic_RIactions_${(new Date()).getTime()}.csv`);
		link.click()
	}
}

async function findRiImprovingActions(market) {
	uri = '/api/v3/markets/'+market+'/actions'
	action_fetch = await fetch(uri)
	all_actions = await action_fetch.json()
	
	ri_improving_actions = []
	for (a = 0; a < all_actions.length; a++) {
		action = all_actions[a]
		
		/* Only care about cloud-related actions that are VM scaling events */
		if (action.target.hasOwnProperty('aspects') && (action.target.aspects.hasOwnProperty('cloudAspect')) && (action.actionType == "SCALE") && (action.target.className == "VirtualMachine")) {

			/* we need to get the details for the action to see RI coverage */
			response = await fetch('/api/v3/actions/'+action.uuid+'/details')
			action_details = await response.json()
			
			/* Check if any RI coverage information is available. */
			if ((action_details.riCoverageBefore) && (action_details.riCoverageAfter)) {
				/* do some math to see if RI usage improves because of this action */
				before_ri_capacity = action_details.riCoverageBefore.capacity.avg
				before_ri_usage = action_details.riCoverageBefore.value
				before_ri_utilization = Math.round((before_ri_usage/before_ri_capacity)*100)
	
				after_ri_capacity = action_details.riCoverageAfter.capacity.avg
				after_ri_usage = action_details.riCoverageAfter.value
				after_ri_utilization = Math.round((after_ri_usage/after_ri_capacity)*100)
				
				if (after_ri_utilization > before_ri_utilization) { 
					/* we got a good one */
					ri_improving_actions.push({
						"instance_name": action.target.displayName,
						"account_name": action.currentLocation.discoveredBy.displayName,
						"instance_id": Object.values(action.target.vendorIds)[0],
						"current_ri_util": before_ri_utilization,
						"new_ri_util": after_ri_utilization,
						"action": action.details,
						"reason": action.risk.subCategory
					})
				}
			}
		}
	}
	
	return ri_improving_actions
}


async function getCurrentMarket() {
	response = await fetch('/api/v3/markets')
	markets = await response.json()
	for (m = 0; m < markets.length; m++) {
		market = markets[m]
		if (market.displayName == "Market") {
			return market.uuid
		}
	}
	return 0
}
