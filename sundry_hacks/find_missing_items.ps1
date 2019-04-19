# Super customized script but figured I would keep it around as an example for future use-cases
# Basically, I have a CSV with a bunch of stuff in it including server names and I have a JSON string with objects in it including server 
# names and I want to identify the ones in the CSV that are not in the JSON

# Use the other script that produces a regular expression of server names and parse that into an array.
param(
[Parameter(Mandatory=$true)][string]$CSV_FILE,
[Parameter(Mandatory=$true)][string]$JSON_STRING_FILE
)
$SERVER_LIST_REGEXP = ./sql2008_name_filter_regexp_from_xls.ps1 $CSV_FILE
foreach ($LINE in $SERVER_LIST_REGEXP) {
	if ($LINE -like '.*|.*') {
		#Write-Output $LINE
		
		$NAMES_STRING = $LINE -replace '[.*]',''
		
		#Write-Output $NAMES_STRING
		
		$NAMES_ARRAY = $NAMES_STRING.split("|")
		
		#Write-Output $NAMES_ARRAY
	}
}

# Process the JSON string into an array of names.
$JSON_STRING = Get-Content $JSON_STRING_FILE | ConvertFrom-JSON
$found_servers_array = @()
foreach ($ITEM in $JSON_STRING) {
	$found_servers_array += @($ITEM.displayName)
}

#Write-Output $found_servers_array


# Compare the arrays and find the missing items
$missing_servers = @()
foreach ($SERVER in $NAMES_ARRAY) {
	#Write-Output "SERVER: $SERVER"
	if ($found_servers_array -NotContains $SERVER) {
		#Write-Output "FOUND MISSING"
		$missing_servers += @($SERVER)
	}
}
		

Write-Output $missing_servers