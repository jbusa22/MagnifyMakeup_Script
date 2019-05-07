const ProdChemExt = () => {
const cheerio = require("cheerio");
const request = require("request-promise");
const puppeteer = require('puppeteer');
let mysql  = require('promise-mysql');

var errors = 0;

var config = {
    host    : 'magnifymakeup.com',
    user    : 'magnifym_JACKB',
    password: 'x3YX4uQXu3WzXFg',
    database: 'magnifym_productresults'
  };

let pool = null;
let retrys = 3;
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

async function extractLinks(url, resolve, reject) {
    const browser = await puppeteer.launch({headless : false});
    const page = await browser.newPage();
    await retryPage(async () => { await page.goto(url)}, retrys);
    await page.setViewport({
        width: 1200,
        height: 800
    });
    // add in next page
    // if the button is disabled then stop
    var i = 1;
    var go = true;
    var matches = [];
    var spec = "";
    while(go)
    {
        await autoScroll(page);
        let html = await page.content();
        // Doesn't Work: await browser.close();
        let cat = html.match(/BreadCrumbs[\s\S]*<\/h1>/);
        console.log(cat[0]);
        let mid = cat[0].match(/Text Box">([\s\S]*?)</);
        let base = getCat(cat[0], /Link Box">([\s\S]*?)</g);
        spec = base + mid[1];
        let rightText = html.match(/ProductGrid">[\s\S]*BccComp|ProductGrid">[\s\S]*css-1bx9fpp/);
        console.log(rightText);
        rightText = rightText[0];
        matches = matches.concat(getMatches(rightText, /href="(.*?\n*?)"/g));
        console.log("Number found: " + matches.length);
        const selector_child  = `button[aria-label='Next']:not([disabled])`;
        let arrow = await page.$(selector_child);
        if(!arrow)
            break;
        i++;
        await retryPage(async () => { await page.goto(url + "?currentPage=" + i)}, retrys);
        await page.waitFor(4000);
    }
    let cnt = 0;
    let promisesArray = [];
    let promisesArrayMatches = [];
    let maxConcurrent = 30;
    pool = await mysql.createPool(config);
    for( let i = 0; i < matches.length; i++)
    {
        try
        {
            promisesArray[cnt] = request("https://www.sephora.com"+ matches[i]);
            promisesArrayMatches[cnt] = matches[i];
            cnt++;
        }
        catch(e)
        {
            console.log( e.message );
            errors++;
        }
        // 30 and i gets to 60 62 products
        // i = 60 matches.length -1 = 61
        // the remainder is the same as the remainder of the max concurrent divided by total
        // After every "maxConcurrent" requests, block until everything is processed.
        // This will block and wait for all requests to come back and then process the data
        if ( (i % maxConcurrent == 0 || i % maxConcurrent == (matches.length -1) % maxConcurrent) && i != 0)
        {
            let resPromisesArray = await Promise.all(promisesArray);
            let extractPromisesArray = [];
        
            for ( let y=0; y< resPromisesArray.length; y++ )
                    extractPromisesArray[y] = new Promise( (resolve, reject) => { extractData( resPromisesArray[y], promisesArrayMatches[y], spec, resolve,reject ); } );
            try
            {
                await Promise.all(extractPromisesArray);
            }
            catch ( e )
            {
                console.log( "Uncaught Error occured: " + e.message);
            }
            promisesArray = [];
            extractPromisesArray = [];
            promisesArrayMatches = [];
            cnt = 0;
        }

    }

    // Wait for anything remaining in promisesArray to finish processing
    if ( promisesArray.length > 0 )
        await Promise.all(promisesArray);
    
    
    
    resolve();
    
    await browser.close();
}
const endpool = async () => 
{
    pool.end();
}

const  extractData = async (html, url, cat, resolve, reject) =>
{
    let connection = await pool.getConnection();
    var newProductId = 0;
    try
    {
        let startDate = Date.now();
        console.log(url);
        // let respHtml2 = request("https://www.sephora.com"+ url);
        // console.log(z + ": " + url);
        let sephid = url.match(/P([\s\S]*)\?/);
        let sephoraid = sephid[1];
        const $ = cheerio.load(html);

        let respHtml = $.html();
        var lsep = respHtml.replace(/<\/*iln.*?>/gi, "");
        var hello = lsep.match(/product_link_brand.*?\n*?>.*?\n*?<span.*?\n*?>(.*?\n*)<\/span><\/a><span.*?\n*?>(.*?\n*)<\/span>/);
        //     <div .*\n*id="tabpanel2.*?\n*?>.*?>.*?<br><br>  (.*?).*
        //      product, ingredient, cas number, percentage, amount in skin, tox report 
        var data1 = hello[1];
        // add to name in database
        var data2 = hello[2];
        // add to brand in database
        var price = respHtml.match(/x">\$([\s\S]*?)</);
        price = price[1];
        
        var check = "SELECT id " + "FROM product " + "WHERE name = '" + data2 + "'";
        let resin = await connection.query(check);
        // execute the insert statment
        if(resin.length == 0)
        {
            //console.log("dsadsa");
            //let connection = await mysql.createConnection(config);
            // insert statment
            let sql = `INSERT INTO product( name, CATEGORY, LINK, SEPHORAID, PRICE, BRAND)
                    VALUES(?,?,?,?,?,?)`;
            let sqlValues = [ data2, cat, url, sephoraid, price, data1];
            
            // execute the insert statment
            //let connection2 = await mysql.createConnection(config);
            let res1 = await connection.query(sql, sqlValues);
            newProductId = res1.insertId;

            // check if there even is an ingredient tab
            if(lsep.match(/Product Information[\S\s]*Ingredients[\S\s]*tab3/) != null)
            {
                var groupThem = lsep.match(/id="tabpanel2[\s\S]*?>[\s\S]*?>[\s\S]*?\s*<\/div>/);
                //Make sure tab 2 is right otherwise go to tab1
                if( groupThem[0].match(/<\/a>/) != null)
                {
                    groupThem = lsep.match(/id="tabpanel1[\s\S]*?>[\s\S]*?>[\s\S]*?\s*<\/div>/);
                }
                var testing = groupThem[0].match(/(?:[^>]*?)(?:,[^,<]*){7,}/g);
                var ingredients = "Few Ingredients";
                
                try
                {
                    
                    ingredients = testing[0];
                    if(testing[0].match(/Complex/))
                        ingredients = testing[1];
                }
                catch(e)
                {
                    console.log(testing);
                    console.log( e.stack );
                    errors++;
                    console.log(errors);
                }
                var v = removeUseless(ingredients);
                //////////////////////////////
                ///////DATABASE ADDING 
                for(let i = 0; i < v.length; i++)
                {
                    var query_var = v[i].trim();
                    
                    if(query_var != "")
                    {
                        let ChemicalId = "";
                        let sqlChem = "SELECT id FROM chemical WHERE name = '"+query_var +"'";
                        let olddupe = await connection.query(sqlChem);
                        if(olddupe.length == 0)
                        {
                            try 
                            {
                                let sqlChem = `INSERT INTO chemical( NAME )
                                VALUES(?)`;
                                let res2 = await connection.query(sqlChem, query_var);
                                ChemicalId = res2.insertId;
                            }
                            catch( e ) 
                            {
                                // Already there
                                if ( e.code && e.code == "ER_DUP_ENTRY")
                                {
                                    var chemdupecheck = "SELECT id " + "FROM chemical " + "WHERE name = '" + query_var + "'";
                                    let getdupes = await connection.query(chemdupecheck);
                                    if ( getdupes && getdupes.length > 0 )
                                            ChemicalId = getdupes[0].id;                                
                                }
                                else
                                {
                                    throw e;
                                }
                            }
                        }
                        else 
                        {
                            let here = JSON.stringify(olddupe);
                            let ba = JSON.parse(here);
                            ChemicalId = ba[0].id;
                        }
                        
                        //let connection3 = await mysql.createConnection(config);
                    
                        // if unique add chemical to chem list
                        // then add product id and new chem id to prodchemlist
                        //console.log('Chem Primary Key created:' + newChemicalId);
                        // execute the insert statment
                        let sqlProductChemical = `INSERT INTO chemprod( PRODID, CHEMID )
                        VALUES(?,?)`;

                        let sqlProductChemicalValues = [ newProductId,ChemicalId];
                        
                        let res3 = await connection.query(sqlProductChemical, sqlProductChemicalValues);
                    }
                        //console.log( "Inserted into ProductChemical table with new Primary key:" + res3.insertId);
                }
            }
            // otherwise 
            else
            {
                let NoChemicalId = 1;
                let sqlProductChemical = `INSERT INTO chemprod( PRODID, CHEMID )
                        VALUES(?,?)`;
                let sqlProductChemicalValues = [ newProductId, NoChemicalId];
                let res3 = await connection.query(sqlProductChemical, sqlProductChemicalValues);
            }
        }
        // otherwise don't do anything because it is already in the database
        else
        {
                console.log("DUUUPE");
        }
        // checking time it took
        let endDate = Date.now();
        console.log( " took " + (( endDate-startDate )/1000 ) + " seconds" );
    }
    catch( e )
    {
        // if the link doesn't have ingredient info just add "no chemicals" to the database
        console.log(e);
        let NoChemicalId = 1;
        let sqlProductChemical = `INSERT INTO chemprod( PRODID, CHEMID )
                VALUES(?,?)`;
        let sqlProductChemicalValues = [ newProductId, NoChemicalId];
        let res3 = await connection.query(sqlProductChemical, sqlProductChemicalValues);
    }
    pool.releaseConnection(connection);
    resolve();
}
// trimming chemical names 
function removeUseless(matched) {
        let start = matched.replace(/&#x2028;/g,"");
        let i = start.replace(/\./g, "");
        let j = i.replace(/\/.+?(?=,)/g, "");
        let o = j.replace(/,[^a-z]*(?=,)/gi, "");
        let d = o.replace(/\s*\(and\)\s*/g,",");
        let g = d.replace(/ \(.*?\)/g,"");
        let k = g.replace(/.*Ingredients:/gi, "");
        let w = k.replace(/,\[[\s\S]*?\]*(?=,)/gi, "");
        let z = w.replace(/[^,]{50,}/g, "");
        let b = z.replace(/\*|\]|\[|\)|\(/g, "");
        let v = b.split(/\s*,\s*/);
        return v; 
}

  function getMatches(string, regex, index) {
    index || (index = 1); // default to the first capturing group
    let matched_links = [];
    let match;
    while (match = regex.exec(string)) {
        matched_links.push(match[index]);
    }
    return matched_links;
  }
  function getCat(string, regex) {
    index = 1; // default to the first capturing group
    var matches = "";
    var match;
    while (match = regex.exec(string)) {
      matches += match[index] + " / ";
    }
    return matches;
  }

  async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
 }
 return {
        endpool : endpool,
        extractData     : extractData,
        extractLinks    : extractLinks
    }

}

module.exports = ProdChemExt();