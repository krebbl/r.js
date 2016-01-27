/* description: Parses end executes mathematical expressions. */

/* lexical grammar */
%lex
%%

// \s+                   /* skip whitespace */
(\-)?[0-9]+("."[0-9]+)?\b  return 'NUMBER'
"true"                return 'TRUE'
"false"               return 'FALSE'
\'[^']*\'             return 'QUOTED'
"null"                return 'NULL'
"?"                   return '?'
':'                   return ':'
"("                   return '('
")"                   return ')'
'{'                   return '{'
'}'                   return '}'
"["                   return '['
"!"                   return '!'
"]"                   return ']'
','                   return ','
[^{><}'.,!()[\]=%|:\s\n\t\+\-\*\\/&? ]+   return 'VARNAME'
\s+                   return 'WS'
[!=><]{1,3}             return 'COMPARATOR'
[^.{}]+               return 'WHATEVER'
'.'                   return '.'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */


%left 'NULL'
%left 'NUMBER'
%left ':'
%left '?'
%left '.'
%left ')'
%left ']'
%right '['
%right '('
%left 'WHATEVER'
%left 'COMPARATOR'
%left 'VARNAME'
%left 'WS'
%left '!'

%start expressions

%% /* language grammar */

expressions
    : text
      {

        var bindings = [];
        var params = [];
        var code = [];
        var fnc = "";
        for(var i = 0; i < $text.length; i ++) { if(typeof($text[i]) == "object") { bindings.push($text[i]); params.push("__rv"+i); code.push("__rv"+i)} else { code.push('"' + $text[i].replace(/\'/g, '"').replace(/\n/," ") + '"') }; };
        if(bindings.length === 1 && code.length === 1) {
          return bindings[0];
        } else {
          var f = new Function("return new Function('"+params.join("','")+"','return "+code.join(" + ")+"')");
          $$  = [{type: 'fnc', name: '', parameters: bindings, fnc: f()}];
        }
        return $$; }
    ;

text
    : binding text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | 'VARNAME' text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | 'WS' text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | '.' text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | '(' text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | ')' text
      { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | 'WHATEVER' text
          { $$ = [$1]; if($2 instanceof Array) { $$ = $$.concat($2); } else { $$.push($2); }}
    | EOF
      { $$ = []; }
    ;

binding
    : '{' expr '}'
        { $$ = $2; }
    ;

expr
  : js
    { var bindings = [];
      var params = [];
      var code = [];
      var fnc = "";
      for(var i = 0; i < $js.length; i ++) { if(typeof($js[i]) == "object") { bindings.push($js[i].path); params.push("__rv"+i); code.push("__rv"+i)} else { code.push($js[i].replace(/\'/g, '"')) }; };
      if(bindings.length === 1 && code.length === 1) {
        $$ = bindings[0];
      } else {
        var f = new Function("return new Function('"+params.join("','")+"','return "+code.join("")+"')");
        $$ = [{type: 'fnc', name: '', parameters: bindings, fnc: f()}];
      }
    }

  ;

js
  : path
      {$$ = [{path: $path}]; }
  | "!" js
      {$$ = $2; $$.unshift("!"); }
  | '(' js ')'
      {$$ = $2; $$.unshift('('); $$.push(')'); }
  | js '?' js ':' js
      { $$ = [];
        if($1 instanceof Array) { $$ = $1 } else { $$ = [$1] };
        $$.push('?');
        if($3 instanceof Array) { $$ = $$.concat($3) } else { $$.push($3) };
        $$.push(':');
        if($5 instanceof Array) { $$ = $$.concat($5) } else { $$.push($5) };
      }
  | js 'WS'
        { $$ = $1;  }
  | 'WS' js
      { $$ = $2;  }
  | js 'COMPARATOR' js
      { $$ = []; if($1 instanceof Array) { $$ = $$.concat($1); } else { $$.push($1) }; $$.push($2); if($3 instanceof Array) { $$ = $$.concat($3); } else { $$.push($3) };  }
  | QUOTED
      {$$ = yytext; }
  | NUMBER
      {$$ = yytext; }
  | NULL
      {$$ = yytext; }
  | TRUE
      {$$ = yytext; }
  | FALSE
      {$$ = yytext; }

  | 'WHATEVER'
      {$$ = yytext; }
  ;

path
    : path '.' pathelement
        {$$ = $path.concat($pathelement);}
    | pathelement
        {$$ = [$pathelement] }
    ;

pathelement
    : VARNAME '(' ')'
        {$$ = {type: 'fnc', name: $1, parameters: []}; }
    | VARNAME '(' parameters ')'
        {$$ = {type: 'fnc', name: $1, parameters: $parameters}; }
    | VARNAME '[' NUMBER ']'
        {
          var f = new Function("a", "return a[" + $3 + "];");
          $$ = {type: 'fnc', parameters: [[{type: 'var', name: $1}]], fnc: f }
        }
    | VARNAME
        {$$ = {type: 'var', name: yytext}; }
    ;

parameters
    : parameters ',' parameter
        {$$ = $parameters; $$.push($parameter); }
    | parameters ',' 'WS' parameter
        {$$ = $parameters; $$.push($parameter);}
    | parameter
        {$$ = [$parameter]; }
    ;
parameter
    : 'TRUE'
        {$$ = true; }
    | 'FALSE'
        {$$ = false; }
    | 'NULL'
        {$$ = null; }
    | 'NUMBER'
        {$$ = Number(yytext); }
    | QUOTED
        {$$ = $1.replace(/^'/,'').replace(/'$/,''); }
    | path
        {$$ = $1; }
      ;
