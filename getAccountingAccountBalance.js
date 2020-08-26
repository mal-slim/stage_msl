function getAccountingAccountBalance( entity, accountingAccount, accountingNorm, currency, dateType, requestedDate, statusList, cpty, currencyOrigin)
{
	var paramsHql = new java.util.HashMap();

	
	var hql = "select accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
	accMvt.cpty.shortname,accMvt.currencyOrigin.shortname,accMvt.folder.id, sum(accMvt.amountOrigin)"
	hql+= " from AccountingMovement accMvt ";

	hql+=  " where " + helper.buildListFilter("accMvt.accountingAccount.id", accountingAccount);
	hql += " and " + helper.buildListFilter("accMvt.currency.id", currency);
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", cpty);
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", entity));
	hql += " and " + helper.buildListFilter(" (select fv.customDictionaryValue.id from FieldValue fv where fv.field.id = " + helper.getUserDataFieldDefinition("accountingAccountAddInfo.accountingNorm").getId() + " and fv.dataEntityType = 'accountingAccount' and accMvt.accountingAccount.id = fv.dataEntityId)", accountingNorm);
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus", statusList));
	hql += " and " + helper.buildListFilter("accMvt.currencyOrigin.id", currencyOrigin);

	if(iParams.get("dateType")== "V"){
		hql += " and  accMvt.valueDate = :requestedDate";
	}
	else{
	    hql += " and accMvt.accountingEntry.accountingDate <= requestedDate";
		
	}
	paramsHql.put("requestedDate", requestedDate);

	hql+= " group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,accMvt.currencyOrigin.shortname,\
		accMvt.cpty.shortname,accMvt.folder.id"
	
	result =  helper.executeHqlQuery(hql, paramsHql);
	return result.get(0)[6];
}
