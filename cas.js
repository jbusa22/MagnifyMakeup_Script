const findCas = () => {
let mysql  = require('promise-mysql');
const request = require("request-promise");
var stringSimilarity = require('string-similarity');
const puppeteer = require('puppeteer');
var config = {
    host    : 'magnifymakeup.com',
    user    : 'magnifym_JACKB',
    password: 'x3YX4uQXu3WzXFg',
    database: 'magnifym_productresults'
  };
var retrys = 3;
const url = 'https://toxnet.nlm.nih.gov/cgi-bin/sis/search2';
async function retryPage(func, retrys) {
    for(let i = 0; i < retrys; i++)
    {
        try 
        {
            return func();
        }
        catch(e)
        {
            if(i == retrys - 1)
                throw e;
        }
    }
}
const processSQL = async () =>
{
    const browser = await puppeteer.launch({headless : false});
    const page = await browser.newPage();
    await retryPage(async () => { await page.goto(url, {"waitUntil" : "networkidle0"})}, retrys);
    await page.setViewport({
        width: 1200,
        height: 800
    });
    var query_str =
    "SELECT name, id " +
    "FROM chemical ";
    let connection = await mysql.createConnection(config);
    let resin = await connection.query(query_str);
    connection.end();
    // execute the insert statment
    //let newProductId = res1.insertId;
    let here = JSON.stringify(resin);
    let ba = JSON.parse(here);
      const selector_child  = `#database-selected-item-default`;
      console.log(`Clicking ${selector_child}`);
      const checkbox = await page.$(selector_child);
      await checkbox.click();
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      //page.click("#database-selected-item-default");
      await page.click("#default-all-database");
      await page.click("#default-ChemIDplus");
      await page.click(".btn-search"); 
      await page.click(".btn-search");
        
    for(let i = 0; i < ba.length; i++)
    {
        try {
            await page.waitFor(1000);
            let check = await page.evaluate((a) => {
                
                document.querySelector('.search-query').value = '';
                document.querySelector('.search-query').value = a;
                return "good";
                
                
                // click id=anch_11
                // click  id=default-all-database
                // click id=default-ChemIDplus
                // click class = btn-search
                // get text of first bodytext then regex out everything but CAS

            }, ba[i].name);
            if(check = "good")
            {
                await page.click(".btn-search"); 
                await page.waitFor(10000);
                let match = await page.evaluate(() => {
                    let yo = "0";
                    if(window.location.href != "https://chem.nlm.nih.gov/chemidplus/chemidlite.jsp")
                    {   
                        try {
                            yo = document.querySelector('.bodytext').innerHTML;
                        }
                        catch
                        {
                            yo = "np";
                        }
                        // click id=anch_11
                        // click  id=default-all-database
                        // click id=default-ChemIDplus
                        // click class = btn-search
                        // get text of first bodytext then regex out everything but CAS
                        return yo;
                    }
                    else 
                    {
                        return "bad";
                    }
        
                });
                if(match == "bad")
                {
                    page.goBack();
                    console.log("bad name: " + ba[i].name + " id: " +  ba[i].id);
                }
                else if(cas = match.match(/[\d]+-[\d]+-[\d]+/))
                {
                    console.log(ba[i].name + " : " + match + " id: " +  ba[i].id);
                    let simName = match.match(/1.[\S\s]*?<b>([\S\s]*?)</);
                    simName = simName[1];
                    console.log(stringSimilarity.compareTwoStrings(ba[i].name.toLowerCase(), simName.toLowerCase()));
                    if(stringSimilarity.compareTwoStrings(ba[i].name.toLowerCase(), simName.toLowerCase()) > .6)
                    {
                        var setCas = "UPDATE chemical " + "SET cas = '" + cas + "' WHERE name = '" + ba[i].name + "'";
                        let connection2 = await mysql.createConnection(config);
                        let updateCas = await connection2.query(setCas);
                        connection2.end();
                    }
                }
                console.log(match);
            }      
        }
        catch(e)
        {
            console.log("CONNECTION ERROR: " + e);
        }     
    }   
}
return {
    processSQL : processSQL
}

}

module.exports = findCas();
