// Loader Header
// @shortname 	=	stdAccountingAccountBalancesDetailled  @
// @name		=	std Accounting Account Balances With Folder  @
// @dataEntity	=   accountingEntry @
// @category	=   excelRules @
// @scope		=   Root  @
// $Id: stdAccountingAccountBalancesDetailled.js,v 1.3 2017/05/18 12:21:04 rko Exp $

/**
 * @fileOverview
 *
 * This rule generate an excel export of the content of accounting account balance detailled
 *
 * @author MCC
 * @version $Id: stdAccountingAccountBalancesDetailled.js,v 1.3 2017/05/18 12:21:04 rko Exp $
 */
/* ****************************************************************************
 * Java used Package
 * ***************************************************************************/
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult)
importClass(Packages.java.text.SimpleDateFormat);
importPackage(Packages.java.util);
importClass(Packages.org.apache.commons.lang.StringUtils);
/* ****************************************************************************
 * Diapason library import
 * ***************************************************************************/
uselib(globalVariableLibrary);
uselib(reportParametersLibrary);
uselib(excelLibrary);
uselib(birtValuationLibrary);
/**
 * @fileOverview <b> Report Header -> Lists all column fields here</b><p>
 * Remember to change along with the corresponding HQL retrieval
 */
 
 
var params = reportParamInitialization(source);  


var expressionContextId = helper.getTransientValue("expressionContextId");
var expressionContextTmp = null; // this value is used as a test
var expressionContextShortname = null;

if (null != expressionContextId) {
	expressionContextTmp = helper.load(com.mccsoft.diapason.data.expressionLanguage.ExpressionContext, helper.parseLong(expressionContextId));
	expressionContextShortname = expressionContextTmp.getShortname();
}
if (null != expressionContextTmp) {
	expressionContextShortname = expressionContextTmp.getShortname();
} else {
	expressionContextShortname = "stdAccountingAccountBalancesDetailled";
}
  
var header = ["currency", "folder","Counterparty","cpty","accountingNorm","InitialSolde","totalCredit","totalDebit","totalFinal","Rate",
"currencyCtrVal","FinalDebitCtrVal","FinalCreditCtrval","InitSoldeCtrVal","FinalSoldeCtrVal"];

var header = header.concat(getContextColumns(expressionContextShortname));



// This array must have same value than query alias. It will order result


[hql,paramsHql]=getRequest(params)	;			
	
var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});


var cashAccountingAccount = new java.util.HashMap();
var cashEntity = new java.util.HashMap();

createHqlReport("stdAccountingBalance", hqlList, header);


function fillRows(iHeader, iHeaderMap, iData) {
    
	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);

	if (iData[0].getCurrency() != null)
		row[iHeaderMap.get("currency")] = iData[0].getCurrency().getShortname();
	
	if (iData[0].getFolder() != null)
		row[iHeaderMap.get("folder")] = iData[0].getFolder().getShortname();

	if (iData[0].getCpty() != null)
		row[iHeaderMap.get("cpty")] = iData[0].getCpty().getShortname();
	
	row[iHeaderMap.get("accountingNorm")] = helper.getUserData(iData[0].getAccountingAccount(),'accountingAccountAddInfo.accountingNorm').getShortname();
	
	var cachedAccAccount = cashAccountingAccount.get(iData[0].getAccountingAccount().getShortname());
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, iData[0].getAccountingAccount());
		cashAccountingAccount.put(iData[0].getAccountingAccount().getShortname(), cachedAccAccount);
	}
	var cachedEntity = cashEntity.get(iData[0].getAccountingEntry().getEntity().getShortname());
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, iData[0].getAccountingEntry().getEntity());
		cashEntity.put(iData[0].getAccountingEntry().getEntity().getShortname(), cachedEntity);
	}

	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);
	


	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}






function completeRowFromMap(iHeaderMap, iMap, oRow) {
	for (var itM = iMap.entrySet().iterator(); itM.hasNext();) {
		var entry = itM.next();
		oRow[iHeaderMap.get(entry.getKey())] = entry.getValue();
	}
}


function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	result = helper.executeHqlQuery(hql, par, -1);
	array = []
	for (var i = 0; i < result.size(); i++) {
		array.push(String(result.get(i)));
	}
	return array;
}



function getRequest(iParams)
{
	var iParamsHql = new java.util.HashMap();

	var hql = " from AccountingMovement accMvt";
	hql+=  " where " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingAccountList"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("currencyList"));
	hql += " and " + helper.buildListFilter("accMvt.folder.id", iParams.get("folder"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", iParams.get("cptyList"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entityList"));
	hql += " and accMvt.accountingEntry.applicativeStatus.internalStatus IN ('validated','cancelled')";
	hql += " and " + helper.buildListFilter("accMvt.accountingAccount.CustomFields.FieldValue.accountingAccountAddInfo.accountingNorm",iParams.get("accountingNormList")) ;
//helper.setUserData(trade,'accountingAccountAddInfo.accountingNorm', iParams.get("accountingNormList"));

	if(iParams.get("dateType")== "V"){
		hql += " and  accMvt.valueDate <= :endDate";
		iParamsHql.put("endDate", helper.parseDate(iParams.get("endDate")));	
	}
	else{
	    hql += " and accMvt.accountingEntry.accountingDate <= :endDate";
		iParamsHql.put("endDate", helper.parseDate(iParams.get("endDate")));
		
	}
	return [hql,iParamsHql];
 


}

