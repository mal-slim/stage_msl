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
function getHeader_En() {
	var headRec = new ArrayList();
	headRec.add("AccountingAccount");
	headRec.add("AccountingAccountName");
	headRec.add("Entity");
	headRec.add("Currency");
	headRec.add("Folder");
	headRec.add("Counterparty");
	headRec.add("AccountingNorm");
	headRec.add("InitialSolde");
	headRec.add("totalCredit");
	headRec.add("totalDebit");
	headRec.add("totalFinal");
	headRec.add("Rate");
	headRec.add("currencyCtrVal");
	headRec.add("FinalDebitCtrVal");
	headRec.add("FinalCreditCtrval");
	headRec.add("InitSoldeCtrVal");
	headRec.add("FinalSoldeCtrVal");
	return headRec.toArray();
}

/**
 * @fileOverview <b> Report Header -> Lists all column fields here</b><p>
 * Remember to change along with the corresponding HQL retrieval
 */
function getSqlHeader() {
	var headRec = new ArrayList();
	headRec.add("AccountSN");
	headRec.add("AccountName");
	headRec.add("Entity");
	headRec.add("Currency");
	headRec.add("Folder");
	headRec.add("Cpty");
	headRec.add("AccountingNorm");
	headRec.add("Balance");
	headRec.add("TotalCredit");
	headRec.add("TotalDebit");
	headRec.add("totalFinal");
	headRec.add("Rate");
	headRec.add("currencyCtrVal");
	headRec.add("FinalDebitCtrVal");
	headRec.add("FinalCreditCtrval");
	headRec.add("InitSoldeCtrVal");
	headRec.add("FinalSoldeCtrVal");
	return headRec.toArray();
}

/**
 * This function is used to set default parameter in excel parameters
 */
function setDefaultParameters(params) {
	helper.log(logLevel, "[excelDefaultParameters.setDefaultParameters] params before : " + params);
	if (params.containsKey("quotationType") == true || params.containsKey("quotationType.paramValue") == true) {
		if (params.get("quotationType") == null) {
			var cu = getCurrencyQuotationTypeDefault();
			params.put("quotationType", cu.getId());
		}
	}
	if (params.containsKey("currencyQuotationType") == true || params.containsKey("currencyQuotationType.paramValue") == true) {
		if (params.get("currencyQuotationType") == null) {
			var cu = getCurrencyQuotationTypeDefault();
			params.put("currencyQuotationType", cu.getId());
		}
	}
	if (params.containsKey("yieldCurveQuotationType") == true || params.containsKey("yieldCurveQuotationType.paramValue") == true) {
		if (params.get("yieldCurveQuotationType") == null) {
			var cu = getCurrencyYieldCurveQuotationTypeDefault();
			params.put("yieldCurveQuotationType", cu.getId());
		}
	}
	if (params.containsKey("valuationCurrency") == true || params.containsKey("valuationCurrency.paramValue") == true) {
		if (params.get("valuationCurrency") == null) {
			var cu = getCurrencyValuationDefault();
			params.put("valuationCurrency", cu.getId());
		}
	}
	if (params.containsKey("quotationDate") == true || params.containsKey("quotationDate.paramValue") == true) {
		if (params.get("quotationDate") == null) {
			if (params.get("situationDate") == null) {
				params.put("quotationDate", getBirtDateFormat().format(new java.util.Date()));
			} else {
				params.put("quotationDate", params.get("situationDate"));
			}
		}
	}
	helper.log(logLevel, "[excelDefaultParameters.setDefaultParameters] params after  : " + params);
	return params;
}

/**
 * Use easily Excel report.
 */
function headerMap(sqlHeader) {
	var headerMap = new java.util.HashMap();
	for (var i = 0; i < sqlHeader.length; i++) {
		headerMap.put(sqlHeader[i], new java.lang.Long(i * 1));
	}
	return headerMap;
}
// A ne pas toucher
// On remplit une nouvelle hashMap qui contiendra les paramètres, que ça soit Birt ou Excel
var params = null;
if (source != null) {
	// Rule called from Birt
	// parameters are sent in source parameter
	params = source.clone();
	helper.log(logLevel, "BIRT");
} else {
	// Rule called from Excel
	// parameters are sent in helper.getParams();
	params = helper.getParams();
	// set default parameter like countervaluation library or quotation type...
	helper.log(logLevel, "EXCEL");
}

var logLevel = "INFO";
helper.log(logLevel, "params : " + params + "");
setDefaultParameters(params)
var pivotCurrency = getPivotCurrency();
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var quotationDate = helper.parseDate(params.get("quotationDate"));
var dateCriteria = (helper.getParamValue("dateType") == "V") ? "accMvt.value_date" : "accEnt.accounting_date";
var header = getHeader_En();

// This array must have same value than query alias. It will order result



var sql = "SELECT accAcc.shortname  	AS accountSN, \
							accAcc.name  		AS AccountName, \
							ent.shortname      	AS Entity,\
							cur.shortname      	AS Currency, \
							fld.shortname        	AS Folder, \
							cpty.shortname     	AS Cpty, \
							acc_norm.shortname 	AS AccountingNorm, \
							sum (CASE \
								WHEN " + dateCriteria + " < [date(:startDate)] \
								THEN accMvt.amount *accMvt.sign \
								ELSE 0.0 \
							  END) AS Balance, \
							sum (CASE \
									WHEN " + dateCriteria + " >= [date(:startDate)] \
										AND " + dateCriteria + " <= [date(:endDate)] \
										AND accMvt.sign >0 \
									THEN accMvt.amount *accMvt.sign \
									ELSE 0.0\
							END) AS TotalCredit, \
							sum (CASE \
									WHEN " + dateCriteria + " >= [date(:startDate)] \
										AND " + dateCriteria + " <= [date(:endDate)] \
										AND accMvt.sign              <0 \
									THEN accMvt.amount *accMvt.sign \
									ELSE 0.0 \
							END) AS TotalDebit, \
							null as totalFinal,\
							null as Rate ,\
							null as currencyCtrVal,\
							null as FinalDebitCtrVal,\
							null as FinalCreditCtrval,\
							null as InitSoldeCtrVal,\
							null as FinalSoldeCtrVal \
						FROM accounting_movement accMvt \
						INNER JOIN accounting_entry accEnt ON accMvt.accounting_entry_fk = accEnt.id \
						INNER JOIN applicative_status apsSta ON apsSta.id = accEnt.applicative_status_fk \
						INNER JOIN entity ent ON ent.id = accEnt.entity_fk \
						INNER JOIN currency cur ON cur.id = accMvt.currency_fk \
						INNER JOIN accounting_account accAcc ON accAcc.id = accMvt.accounting_account_fk \
						INNER JOIN (SELECT cdv.id, cdv.shortname, fv.data_entity_id \
										FROM custom_dictionary_value cdv \
										INNER JOIN field_value fv ON fv.custom_dictionary_value_fk = cdv.id \
										WHERE [fv.field_fk = :accountingNormField] \
										AND fv.data_entity_type  = 'accountingAccount' \
									) acc_norm ON acc_norm.data_entity_id = accAcc.id \
						LEFT JOIN folder fld ON fld.id = accMvt.folder_fk \
						LEFT JOIN entity cpty ON cpty.id = accMvt.cpty_fk \
						where [accAcc.id in list(:accountingAccountList)] \
						and apsSta.internal_status IN ('validated','cancelled') \
						and [accMvt.folder in list(:folderList)] \
						and [accMvt.cpty_fk in list(:cptyList)] \
						and [accEnt.entity_fk in list(:entityList)] \
						and [accMvt.currency_fk in list(:currencyList)] \
						and [acc_norm.id in list(:accountingNormList)] \
						and " + dateCriteria + " <= [date(:endDate)] \
						AND (accEnt.entity_fk in (select CODE from TABLE(MccFilter.grantedList('ENTITY','INTERNAL_SCOPE_FK','entity','children',[:scope])))) \
						group BY accAcc.shortname, \
						accAcc.name, \
						ent.shortname, \
						cur.shortname, \
						fld.shortname, \
						cpty.shortname, \
						acc_norm.shortname";

// This function convert Diapason syntax in sql and replace all parameters
params.put("accountingNormField", helper.loadProviderReferenceField("accountingAccountAddInfo.accountingNorm").getId());
sql = helper.processSqlQuery(sql, params);
helper.log(logLevel, "stdBudgetByVersionReport :: sql : " + sql);

helper.createScrollableSqlQuery(sql, null);

// Map used to help to use row
var sqlHeader = getSqlHeader();
// Add header in relation to breakdown filled in

// arrayList to put result after modification
var cursor = new java.util.ArrayList();
var isEmpty = true;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;
// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
var nbScroll = 0;
while (helper.hasMoreResults()) {
	var entries = helper.getNextResults(1000);
	range.result.cursor.clear();
	for (var iterator = entries.iterator(); iterator.hasNext(); ) {
		var row = iterator.next();
		var entry = java.util.Arrays.copyOf(row, header.length);
		var currency = helper.getItemFromShortname(entry[sqlHeaderMap.get("Currency")], "com.mccsoft.diapason.data.Currency", false);
		entry[sqlHeaderMap.get("currencyCtrVal")] = valuationCurrency.getShortname();
		
		var balanceInit = helper.parseNumber(entry[sqlHeaderMap.get("Balance")]);
		var totalDebit = helper.parseNumber(entry[sqlHeaderMap.get("TotalDebit")]);
		var totalCredit = helper.parseNumber(entry[sqlHeaderMap.get("TotalCredit")]);
		
		//sum init + credi  + debit
		var total = balanceInit.add(totalDebit);
		total = total.add(totalCredit);
		entry[sqlHeaderMap.get("totalFinal")] = total;
		
		helper.log(logLevel, "stdAccountingAccountBalancesWithFolder currency : " + currency.getShortname());
		helper.log(logLevel, "stdAccountingAccountBalancesWithFolder balanceInit : " + balanceInit);
		helper.log(logLevel, "stdAccountingAccountBalancesWithFolder totalDebit : " + totalDebit);
		helper.log(logLevel, "stdAccountingAccountBalancesWithFolder totalCredit : " + totalCredit);
		var initSoldeCtrVal = countervaluation(balanceInit, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);
		var totalDebitCtrval = countervaluation(totalDebit, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);
		var totalCreditCtrval = countervaluation(totalCredit, currency, valuationCurrency, pivotCurrency, quotationType, quotationDate, false);

		entry[sqlHeaderMap.get("Rate")] = initSoldeCtrVal.get("rate");
		
		entry[sqlHeaderMap.get("FinalCreditCtrval")] = totalCreditCtrval.get("countervalue");
		entry[sqlHeaderMap.get("FinalDebitCtrVal")] = totalDebitCtrval.get("countervalue");
		entry[sqlHeaderMap.get("InitSoldeCtrVal")] = initSoldeCtrVal.get("countervalue");
		
		var totalCtrval = initSoldeCtrVal.get("countervalue");
		totalCtrval = totalCtrval.add(totalDebitCtrval.get("countervalue"));
		totalCtrval = totalCtrval.add(totalCreditCtrval.get("countervalue"));
		entry[sqlHeaderMap.get("FinalSoldeCtrVal")] = totalCtrval;
		range.result.cursor.add(entry);
	}
	if (nbScroll == 0 && range.result.cursor.isEmpty()) {
		range.initEmptyRange(); // In case we would build a TCD from that range
	}
	helper.fillInSheetFromCursor(range);
	nbScroll++;
}
helper.closeScrollableQuery();
