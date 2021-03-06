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
var expressionContextTmp = null;
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

var header = [ "currency", "accountingNorm", "InitialSolde", "totalCredit", "totalDebit", "totalFinal", "Rate",
	"currencyCtrVal", "FinalDebitCtrVal", "FinalCreditCtrval", "InitSoldeCtrVal", "FinalSoldeCtrVal"];

var header = header.concat(getContextColumns(expressionContextShortname));

var pivotCurrency = getPivotCurrency();
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var quotationDate = helper.parseDate(params.get("quotationDate"));

[hql, paramsHql] = getAccountingAccountBalance(params);

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
	var ParamsHql = new java.util.HashMap();
	var hql2 = "from AccountingAccount ac where ac.shortname= :accountShortname";
	ParamsHql.put("accountShortname", iData[0]);
	result2 = helper.executeHqlQuery(hql2, ParamsHql);

	var iParamsHql1 = new java.util.HashMap();
	var hql1 = "from Entity en where en.shortname= :entityShortname";
	iParamsHql1.put("entityShortname", iData[1]);
	result1 = helper.executeHqlQuery(hql1, iParamsHql1);

	var currency = helper.getItemFromShortname(iData[2], "com.mccsoft.diapason.data.Currency", false);

	var totalCredit = computeBalance(iData[0], iData[1], iData[2], iData[3], "totalCredit");
	var totalDebit = computeBalance(iData[0], iData[1], iData[2], iData[3], "totalDebit");
	var InitialSolde = computeBalance(iData[0], iData[1], iData[2], iData[3], "initSolde");
	row[iHeaderMap.get("currencyCtrVal")] = valuationCurrency.getShortname();
	row[iHeaderMap.get("InitialSolde")] = InitialSolde;
	row[iHeaderMap.get("totalCredit")] = totalCredit;
	row[iHeaderMap.get("totalDebit")] = totalDebit;

	var total = InitialSolde.add(totalDebit);
	total = total.add(totalCredit);
	row[iHeaderMap.get("totalFinal")] = total;
	var initSoldeCtrVal = countervaluation(InitialSolde, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);
	var totalDebitCtrval = countervaluation(totalDebit, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);
	var totalCreditCtrval = countervaluation(totalCredit, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);

	row[iHeaderMap.get("Rate")] = initSoldeCtrVal.get("rate");
	row[iHeaderMap.get("FinalCreditCtrval")] = totalCreditCtrval.get("countervalue");
	row[iHeaderMap.get("FinalDebitCtrVal")] = totalDebitCtrval.get("countervalue");
	row[iHeaderMap.get("InitSoldeCtrVal")] = initSoldeCtrVal.get("countervalue");

	var totalCtrval = initSoldeCtrVal.get("countervalue");
	totalCtrval = totalCtrval.add(totalDebitCtrval.get("countervalue"));
	totalCtrval = totalCtrval.add(totalCreditCtrval.get("countervalue"));
	row[iHeaderMap.get("FinalSoldeCtrVal")] = totalCtrval;

	if (iData[2] != null)
		row[iHeaderMap.get("currency")] = iData[2];

	

	row[iHeaderMap.get("accountingNorm")] = helper.getUserData(result2.get(0), 'accountingAccountAddInfo.accountingNorm').getShortname();

	var cachedAccAccount = cashAccountingAccount.get(iData[0]);
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, result2.get(0));
		cashAccountingAccount.put(iData[0], cachedAccAccount);
	}
	var cachedEntity = cashEntity.get(iData[1]);
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, result1.get(0));
		cashEntity.put(iData[1], cachedEntity);
	}

	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);

	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}

//used to compute initSolde, totalCredit, totalDebit according to type
function computeBalance(iAccountShortname, iEntity, iCurrency, iCpty, type) {
	var paramsHql = new java.util.HashMap();
	var hql = "select COALESCE(sum(accMvt.amountOrigin* accMvt.sign),0.0) from AccountingMovement accMvt"
		hql += " where accMvt.accountingAccount.shortname = :accountShortname";
	hql += " and accMvt.accountingEntry.entity.shortname = :entityShortname";
	hql += " and accMvt.currency.shortname = :currencyShortname";
	

	if (params.get("dateType") == "V") {
		hql += " and accMvt.valueDate <= :endDate";
		if (type == "initSolde") {
			hql += " and accMvt.valueDate < :startDate";
		} else {
			hql += " and accMvt.valueDate >= :startDate";
			if (type == "totalCredit")
				hql += " and accMvt.sign > 0";
			else
				hql += " and accMvt.sign < 0";
		}
	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :endDate";
		if (type == "initSolde") {
			hql += " and accMvt.accountingEntry.accountingDate < :startDate";
		} else {
			hql += " and accMvt.accountingEntry.accountingDate >= :startDate";

			if (type == "totalCredit")
				hql += " and accMvt.sign > 0";
			else
				hql += " and accMvt.sign < 0";
		}
	}
	paramsHql.put("endDate", helper.parseDate(params.get("endDate")));
	paramsHql.put("accountShortname", iAccountShortname);
	paramsHql.put("entityShortname", iEntity);
	paramsHql.put("currencyShortname", iCurrency);
	paramsHql.put("startDate", helper.parseDate(params.get("startDate")));
	result = helper.executeHqlQuery(hql, paramsHql);
	return result.get(0);
}

function completeRowFromMap(iHeaderMap, iMap, oRow) {
	for (var itM = iMap.entrySet().iterator(); itM.hasNext(); ) {
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

function getAccountingAccountBalance(iParams) {
	var iParamsHql = new java.util.HashMap();

	var hql = "select accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname, sum(accMvt.amountOrigin)"
		hql += " from AccountingMovement accMvt ";

	hql += " where " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingAccountList"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("currencyList"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entityList"));
	hql += " and accMvt.accountingEntry.applicativeStatus.internalStatus IN ('validated','cancelled')";
	hql += " and " + helper.buildListFilter(" (select fv.customDictionaryValue.id from FieldValue fv where fv.field.id = " + helper.getUserDataFieldDefinition("accountingAccountAddInfo.accountingNorm").getId() + " and fv.dataEntityType = 'accountingAccount' and accMvt.accountingAccount.id = fv.dataEntityId)", iParams.get("accountingNormList"));

	if (iParams.get("dateType") == "V") {
		hql += " and  accMvt.valueDate <= :endDate";
	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :endDate";

	}
	iParamsHql.put("endDate", helper.parseDate(iParams.get("endDate")));

	hql += " group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname"
	return [hql, iParamsHql];

}
