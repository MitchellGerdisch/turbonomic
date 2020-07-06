/* 
 * Finds PERFORMANCE actions that improve cost.
 * This may happen if the new instance type is a cheaper generation of instance type.
 */

/* Auto call the function to get things going */
getCostImprovingActions_xl()

async function getCostImprovingActions_xl() { 
	
	console.log("")
	console.log("**** Looking for cost-improving performance actions ... this may take a few minutes ...")
	console.log("")
	
	current_market = await getCurrentMarket()
	if (current_market == 0) {
		console.log("*** ERROR *** Something is not right. No market was found.") 
		return
	}
	
	cost_improving_actions = await findCostImprovingActions(current_market)
	
	if (cost_improving_actions.length == 0) {
		console.log("*** NO COST IMPROVING PERFORMANCE ACTIONS FOUND. ***")
	} else {
		console.log("*** Found some cost improving performance actions ...")

		csvContent = "data:text/csv;charset=utf-8,";
		csvContent += "Instance Name,Account Name,Instance ID,Savings,Action,Reason,Reason Description\n" 
			
		for (i = 0; i < cost_improving_actions.length; i++) {
			action = cost_improving_actions[i]
			instance = action.instance_name
			instance_id = action.instance_id
			savings = action.savings
			account = action.account_name
			action = action.action
			reason = action.reason
			reason_description = action.reason_description
			
			console.log("Instance Name: "+ instance); 
			console.log("- Account Name: "+ account);
			console.log("- Instance ID: "+ instance_id);
			console.log("- Savings: "+savings);
			console.log("- Action: " + action);
			console.log("- Reason: " + reason);
			console.log("- Reason Description: " + reason_description);
			csvContent += instance + "," + account + "," + instance_id + "," + savings + "," + action + "," + reason + "," + reason_description + "\n"
		}

		console.log("*** Downloading CSV containing RI-improving actions.")
		link = document.createElement('a')
		link.setAttribute('href', encodeURI(csvContent));
		link.setAttribute('download', `turbonomic_RIactions_${(new Date()).getTime()}.csv`);
		link.click()
	}
}

async function findCostImprovingActions(market) {
	
	/* Only care about cloud related resize type of actions that improve performance */
	actions_body = {
			"actionTypeList": [
				"RESIZE",
				"RIGHT_SIZE",
				"SCALE"
			],
			"environmentType": "CLOUD",
			"riskSubCategoryList": [
				"Performance Assurance"
			],
			"detailLevel": "EXECUTION"
	}
	
	/* API defaults to 500 max elements - so use cursor attribute, if needed, to call API multiple times to get all the actins. */
	all_actions = []
	cursor = 0
	looking_for_actions = true
	while (looking_for_actions) {
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
	
	cost_improving_perf_actions = []
	for (a = 0; a < all_actions.length; a++) {
		if ((a%100) == 0) {
			console.log("**** ... still looking for actions ...")
		}
		action = all_actions[a]
		
		if (action.hasOwnProperty(stats)) {
			savings = action.stats[0].value
			
			if (savings > 0) {
				cost_improving_perf_actions.push({
					"instance_name": action.target.displayName,
					"instance_id": action.target.uuid,
					"account_name": action.currentLocation.discoveredBy.displayName,
					"savings": savings,
					"action": action.details,
					"reason": action.risk.subCategory,
					"reason_description": action.risk.description
				})
			}
		}
	}
	
	return cost_improving_perf_actions 
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
