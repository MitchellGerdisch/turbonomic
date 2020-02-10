/* Documented in Green Circle article, DOC-6375
 * If this script is changed, be sure to update the article.
 */

csvContent = "data:text/csv;charset=utf-8,";
csvContent += "Instance Name,Current RI Utilization,New RI Utilization,Action,Reason\n" 

no_action_found = true;
fetch('/vmturbo/rest/markets/Market/actions').then(res => {
	return res.json();
}).then(actions => {
	actions.map(record => {
		new_coverage = 0;
		return_line = "";
		try {
			if (record.target.className == "VirtualMachine") {
				current_ri_coverage_percentage = record.target.aspects.cloudAspect.riCoveragePercentage;
				coupon_value = record.reservedInstance.coupons.value;
				coupon_avg = record.reservedInstance.coupons.capacity.avg;
				new_coverage = Math.round((coupon_value/coupon_avg)*100);
				if (new_coverage > 0) {
					no_action_found = false;
					console.log("Instance Name: "+ record.target.displayName); 
					console.log("- Current RI Utilization: "+ current_ri_coverage_percentage + "%");
					console.log("- New RI Utilization: " + new_coverage + "%");
					console.log("- Action: " + record.details);
					console.log("- Reason: " + record.risk.subCategory);
					csvContent += record.target.displayName + "," + current_ri_coverage_percentage + "," + new_coverage + "," + record.details + "," + record.risk.subCategory + "\n"
				}
			}
		} catch(err) {} 
	});
	if (no_action_found) {
		console.log("*** NO RI UTILIZATION IMPROVING ACTIONS FOUND. ***")
	}
	
	link = document.createElement('a')
	link.setAttribute('href', encodeURI(csvContent));
	link.setAttribute('download', `turbonomic_rdyq_${(new Date()).getTime()}.csv`);
	link.click()
});
