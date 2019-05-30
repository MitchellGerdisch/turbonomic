# Documented in Green Circle article, DOC-XXXX
# If this script is changed, be sure to update the article.

fetch('/vmturbo/rest/markets/Market/actions').then(res => {
	return res.json();
}).then(actions => {
	actions.map(record => {
		new_coverage = 0;
		return_line = "";
		try {
			coupon_value = record.reservedInstance.coupons.value;
			coupon_avg = record.reservedInstance.coupons.capacity.avg;
			new_coverage = Math.round((coupon_value/coupon_avg)*100);
			if (new_coverage > 0) {
				console.log("Instance Name: "+ record.target.displayName); 
				console.log("- RI Utilization: " + new_coverage + "%");
				console.log("- Action: " + record.details);
			}
		} catch(err) {} 
	});
});