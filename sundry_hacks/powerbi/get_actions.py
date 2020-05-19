##### NOTE NOTE NOTE #####
# This script works for the most part. It requires loading it in powerbi desktop and then modifying the query so it can use
# the powerbi parameters. It's described in the initial value of actions_info[].
# That all said, it's not that great overall but being kept for reference.
# The decision was made to push data into PowerBi using a Power BI streaming dataset. See colocated powershell script for more.
#####



# This python script is meant to be run in PowerBI desktop.
# It produces pandas dataframes formatted output which can then be used as a datasource in PowerBI.
# 
# Prereqs:
# - PowerBI desktop
# - Python 3.8 installed and pandas, matplotlib python modules installed.

import pandas as pd
import json
import urllib3
import requests
import getpass
from requests.exceptions import HTTPError

requests.packages.urllib3.disable_warnings()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_json_from_url_turbo(url):
    response = s.get(url, headers={'content-type': 'application/json', 'Authorization':authToken}, verify=False, timeout=15)
    if response.status_code == 200:
        content = response.content.decode("utf8")
        js = json.loads(content)
    else:
        js = None
        print(str(DT.now()), "API Call Failed:", response.status_code, "\n", url, "\n")
    return js


actions_info = [{"instructions":"go to advanced editor and put \'\" around parameter settings and refresh"}]

### Need to modify in PowerBI definition so that they have single and then double quotes around them: '"...."'
turbo_ip = '&Text.From(TURBO_IP)&'
username = '&Text.From(TURBO_USER)&'
password = '&Text.From(TURBO_PASSWORD)&'

s = requests.Session()

# authenticate - all cookies received will be stored in the session object
try:
    payload={"username":username,"password":password}
    response = s.post("https://{}/api/v3/login".format(turbo_ip),data=payload, verify=False)
    content = response.content.decode("utf8")
    js = json.loads(content)
    authToken = js["authToken"]
except:
    pass

# Find current real time market
try:
    url = "https://{}/api/v3/markets".format(turbo_ip)
    response = get_json_from_url_turbo(url)
    for mkt in response:
        if mkt["displayName"] == "Market":
            mkt_uuid = mkt["uuid"]
except:
    pass

# Get ALL actions currently available for the realtime market
# TO DO: Add support for more than 500 actions via API cursor/pagination
try:
    url = "https://{}/api/v3/markets/{}/actions".format(turbo_ip, mkt_uuid)
    actions = get_json_from_url_turbo(url)
    # reset actions_info
    actions_info = []
    for action in actions:
        if action["target"]["className"] == "VirtualMachine":
            actions_info.append({"target_uuid": action["target"]["uuid"], "target_name": action["target"]["displayName"], "action": action["details"], "action_uuid": action["uuid"]})
except:
    pass

actions_table = pd.read_json(json.dumps(actions_info), orient='records')
print(actions_table)
    
# Format data for PowerBI output