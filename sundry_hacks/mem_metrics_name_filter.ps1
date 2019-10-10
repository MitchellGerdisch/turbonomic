# Looks for  servers in a CSV file with mem metrics ("memorySize") and produces a big OR-ed regular expression that can be used to define a Virtual Machine dynamic group in Turbonomic

# INPUTS: 
#	CSV_FILE: A CSV file of actions from Turbo 
#
# OUTPUT: a regular expression of server names to be used as a Name filter for a Turbonomic Virtual Machine Dynamic group.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

$FILTER_REGEXP = ""
$NUMBER_FOUND_SERVERS = 0
foreach ($ITEM in $JSON_STUFF) {
	$NAME = $ITEM."target/displayName"
	$SERVER_NAME = $NAME  #.split("@")[1]
	#Write-Output "Server Name: $SERVER_NAME"
	$MEM_METRICS = $ITEM."risk/reasonCommodity"
	$SERVER_TYPE = $ITEM."target/className"
	if (($MEM_METRICS -match 'VMem') -and ($SERVER_TYPE -match "VirtualMachine")) { # Then we can assume we have an instance with memory metrics are enabled
		Write-Output "GOOD: $NAME --  $MEM_METRICS" 
		$NAME_REGEXP = "$SERVER_NAME"
		if ($FILTER_REGEXP) {
			if (-Not $FILTER_REGEXP.Contains($NAME_REGEXP)) {
				$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
				$FILTER_REGEXP= "$FILTER_REGEXP|$NAME_REGEXP" 
			}
		} else {
			$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
			$FILTER_REGEXP = $NAME_REGEXP
		}
	}
}


Write-Output "Found $NUMBER_FOUND_SERVERS Servers"
Write-Output ""
Write-Output $FILTER_REGEXP