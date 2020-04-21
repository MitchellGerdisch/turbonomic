# Creates a big OR-ed regular expression that can be used to define a Virtual Machine dynamic group in Turbonomic
# Pulls together the list from a CSV with a column called "Name"

# INPUTS: 
#	CSV_FILE: A CSV file from the Get_RIs_from_Chrome_Console.js script or a CSV with a column named "Instance Name" that has the intance names
#
# OUTPUT: a regular expression of server names to be used as a Name filter for a Turbonomic Virtual Machine Dynamic group.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

#Write-Output $JSON_STUFF

# This will create multiple groups where no group is larger than 1000 servers.
# This is in case running a plan for one big group of, say, 7000 servers is problem.
$SERVER_GROUP_NUMBER = 1

$SERVER_REGEXP = ""
$NUMBER_FOUND_SERVERS = 0
foreach ($ITEM in $JSON_STUFF) {
	$SERVER_NAME = $ITEM."Instance Name"
	#Write-Output "Server Name: $SERVER_NAME"
	#$OS = $ITEM."Operating System"
		$SERVER_NAME = $SERVER_NAME.split('.')[0]
		Write-Output "FOUND SERVER: $SERVER_NAME"
		$NAME_REGEXP = "^$SERVER_NAME$"
		if ($SERVER_REGEXP) {
			if (-Not $SERVER_REGEXP.Contains($NAME_REGEXP)) {
				$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
				$SERVER_REGEXP = "$SERVER_REGEXP|$NAME_REGEXP" 
			}
		} else {
			$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
			$SERVER_REGEXP = $NAME_REGEXP
		}
		
		#if (($NUMBER_FOUND_SERVERS % 1000) -eq 0) {
			#Write-Output "########################################"
			#Write-Output "Server Group #$SERVER_GROUP_NUMBER"
			#Write-Output $SERVER_REGEXP
			#$SERVER_GROUP_NUMBER = $SERVER_GROUP_NUMBER + 1
			#$SERVER_REGEXP = ""
		#}
}


Write-Output "Found $NUMBER_FOUND_SERVERS Servers"
Write-Output ""
Write-Output $SERVER_REGEXP