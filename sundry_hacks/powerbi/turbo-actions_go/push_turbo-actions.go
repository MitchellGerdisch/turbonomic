package main

import (
    "bytes"
 	"mime/multipart"
	"encoding/json"
	"strings"
    "fmt"
    "io/ioutil"
    "net/http"
    "crypto/tls"
    "flag"
    "os"
)

type CriteriaList struct {
	expType string 
	expVal string 
	filterType string 
	caseSensitive bool
}
type SearchBody struct {
	criteriaList CriteriaList 
	logicalOperator string 
	className string 
}

func main() {

	turbo_user := flag.String("turbo_user", "", "Turbo Username")
	turbo_password:= flag.String("turbo_password", "", "Turbo Password")
	turbo_instance := flag.String("turbo_instance", "", "Turbo IP or FQDN")
	csv_file := flag.String("csv_file", "", "CSV File containing App to Server mapping - \"Component_id\" and \"Server_Name\" columns required")
	powerbi_stream_url := flag.String("powerbi_stream_url", "", "URL for the PowerBI Stream Dataset")

	flag.Parse()
	
	if ((*turbo_user == "") || (*turbo_password == "") || (*turbo_instance == "") || (*csv_file == "") || (*powerbi_stream_url == "")) {
		fmt.Println("*************")
		fmt.Println("Missing command line argument ...")
		fmt.Println("Run \""+os.Args[0]+" -h\" for more information.")
		fmt.Println("*************")
		os.Exit(1)
	}

	// Turbo authentication
	fmt.Println("Authenticating ...")

  	url := "https://"+ *turbo_instance +"/vmturbo/rest/login"
  	method := "POST"

  	payload := &bytes.Buffer{}
  	writer := multipart.NewWriter(payload)
  	_ = writer.WriteField("username", *turbo_user)
  	_ = writer.WriteField("password", *turbo_password)
  	err := writer.Close()
  	if err != nil {
    	fmt.Println(err)
  	}

	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}

  	req, err := http.NewRequest(method, url, payload)
  	if err != nil {
    	fmt.Println(err)
  	}
  	req.Header.Set("Content-Type", writer.FormDataContentType())
  	res, err := client.Do(req)
  	if err != nil {
    	fmt.Println(err)
  	}
  	defer res.Body.Close()
  	body, err := ioutil.ReadAll(res.Body)
  	
  	fmt.Println(string(body))
  	
  	// TEST TURBO API CALL
  	
  	/*
  	entityName := "jason6110"
  	searchBody := SearchBody{
  		criteriaList: CriteriaList{
  			expType: "RXEQ",
  			expVal: "^"+entityName+"$",
  			filterType: "vmsByName",
  			caseSensitive: true,
  			
  		},
  		logicalOperator: "AND",
  		className: "VirtualMachine",
  	}
  */	

	url = "https://xl1.demo.turbonomic.com/api/v3/search?q="
	method = "POST"
	
	vm_payload := strings.NewReader("{\n  \"className\": \"VirtualMachine\",\n  \"criteriaList\": [\n    {\n      \"expVal\": \"^turbonomic-7.21.5-DS$\",\n      \"caseSensitive\": \"\",\n      \"filterType\": \"vmsByName\",\n      \"expType\": \"RXEQ\"\n    }\n  ],\n  \"logicalOperator\": \"AND\"\n}")
	
	
	client = &http.Client{Transport: customTransport}	

	req, err = http.NewRequest(method, url, vm_payload)
	if err != nil {
	fmt.Println(err)
	}
	req.Header.Add("Authorization", "Bearer eyJhbGciOiJFUzI1NiIsInppcCI6IkdaSVAifQ.H4sIAAAAAAAAAKtWKi5NUrJSKsgvTy1KylTSUfIscExJKUotLgaKGhroGZrpGZob6xkZAqWC_H1cg5WsopUcXXw9_TyDQ4IcQ_yDlGJ1lEJDPV2A6o0NzMzNLU0tzS2MzI2AGgKC_MM8XVyDgFI-_s6OPkq1AJPG0rNwAAAA.sgOl49XrEMqtCkGpK0vMBexs2VHLKPfCOvpJvwde_PXcz-BzssfGn-l9oMIWgkK26YYfKgnrGgREdo0QffJZPw")
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Cookie", "JSESSIONID=node0q51gj5ucgev21q86qnpby0lxz504.node0")
	res, err = client.Do(req)
	defer res.Body.Close()
	body, err = ioutil.ReadAll(res.Body)
	fmt.Println(string(body))
	
	jsonData := []byte(body)

	var v interface{}
	json.Unmarshal(jsonData, &v)
	data := v.(map[string]interface{})

	for k, v := range data {
    switch v := v.(type) {
    case string:
        fmt.Println(k, v, "(string)")
    case float64:
        fmt.Println(k, v, "(float64)")
    case []interface{}:
        fmt.Println(k, "(array):")
        for i, u := range v {
            fmt.Println("    ", i, u)
        }
    default:
        fmt.Println(k, v, "(unknown)")
    }
}
	
	/*
	fmt.Printf("The struct returned before marshalling\n\n")
	fmt.Printf("%+v\n\n\n\n", searchBody)
	
	// The MarshalIndent function only serves to pretty print, json.Marshal() is what would normally be used
	byteArray, err := json.Marshal(searchBody)
	
	if err != nil {
	fmt.Println(err)
	}
	
	fmt.Printf("The JSON returned when the struct is marshalled\n\n")
	fmt.Println(string(byteArray))
	*/
}	