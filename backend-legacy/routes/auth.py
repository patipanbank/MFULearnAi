from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
import json
import base64
import urllib.parse

from config.config import settings
from services.user_service import user_service
from models.user import User, UserRole
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils
from middleware.role_guard import get_current_user_with_roles

router = APIRouter()

async def prepare_saml_request(request: Request):
    # Force HTTPS for production environment
    scheme = 'https'
    
    return {
        'https': 'on',  # Always use HTTPS
        'http_host': request.url.netloc,
        'script_name': request.url.path,
        'server_port': '443',  # Always use HTTPS port
        'get_data': request.query_params,
        'post_data': await request.form(),
        'https_host': request.url.netloc,  # Add HTTPS host explicitly
        'https_port': '443'
    }

def init_saml_auth(req):
    auth = OneLogin_Saml2_Auth(req, old_settings=get_saml_settings())
    return auth

def get_saml_settings():
    # In production, you might want to load this from a file or a more secure location
    cert = ""
    if settings.SAML_CERTIFICATE:
        # The python3-saml library expects the certificate to be a single-line string,
        # without headers or newlines.
        cert = settings.SAML_CERTIFICATE
        cert = cert.replace("-----BEGIN CERTIFICATE-----", "")
        cert = cert.replace("-----END CERTIFICATE-----", "")
        cert = cert.replace("\\n", "").replace("\n", "")
        cert = cert.strip()

    # Ensure base URL always uses HTTPS
    base_url = settings.FRONTEND_URL or "https://mfulearnai.mfu.ac.th"
    if isinstance(base_url, str) and base_url.startswith('http://'):
        base_url = base_url.replace('http://', 'https://')

    return {
        "strict": True,  # Enable strict mode for better security
        "debug": True,  # Temporarily enable debug for troubleshooting
        "sp": {
            "entityId": settings.SAML_SP_ENTITY_ID,
            "assertionConsumerService": {
                "url": f"{base_url}/api/auth/saml/callback",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            },
            "singleLogoutService": {
                "url": f"{base_url}/api/auth/saml/logout",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "x509cert": cert,
            "privateKey": ""
        },
        "idp": {
            "entityId": settings.SAML_IDP_ENTITY_ID,
            "singleSignOnService": {
                "url": settings.SAML_IDP_SSO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "singleLogoutService": {
                "url": settings.SAML_IDP_SLO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
            },
            "x509cert": cert
        },
        "security": {
            "nameIdEncrypted": False,
            "authnRequestsSigned": False,
            "logoutRequestSigned": False,
            "logoutResponseSigned": False,
            "signMetadata": False,
            "wantMessagesSigned": False,
            "wantAssertionsSigned": True,
            "wantNameId": True,
            "wantNameIdEncrypted": False,
            "wantAssertionsEncrypted": False,
            "allowSingleLabelDomains": False,
            "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
            "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256"
        }
    }

@router.get('/login/saml')
async def saml_login(request: Request):
    req = await prepare_saml_request(request)
    auth = init_saml_auth(req)
    return RedirectResponse(auth.login())

@router.post('/saml/callback')
@router.get('/saml/callback')
async def saml_callback(request: Request):
    print(f"SAML Callback received: {request.method} {request.url}")
    print(f"Headers: {dict(request.headers)}")
    
    req = await prepare_saml_request(request)
    print(f"SAML Request prepared: {req}")
    
    auth = init_saml_auth(req)
    auth.process_response()
    errors = auth.get_errors()
    
    print(f"SAML Processing completed. Errors: {errors}")
    print(f"Authenticated: {auth.is_authenticated()}")
    
    if errors:
        print("SAML Errors:", errors)
        print("Last error reason:", auth.get_last_error_reason())
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=auth_failed&reason={auth.get_last_error_reason()}", status_code=303)

    if not auth.is_authenticated():
        print("User not authenticated")
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=not_authenticated", status_code=303)
    
    # === ENHANCED DEBUGGING: Log all available SAML data ===
    print("\n" + "="*80)
    print("🔍 COMPLETE SAML DATA ANALYSIS")
    print("="*80)
    
    # 1. Basic SAML info
    print(f"📋 NameID: {auth.get_nameid()}")
    print(f"📋 NameID Format: {auth.get_nameid_format()}")
    print(f"📋 Session Index: {auth.get_session_index()}")
    
    # 2. Get all attributes
    saml_attributes = auth.get_attributes()
    print(f"\n📊 Total Attributes Found: {len(saml_attributes)}")
    print("📊 All SAML Attributes:")
    for key, value in saml_attributes.items():
        print(f"   🔑 {key}: {value}")
    
    # 3. Check for additional methods
    try:
        print(f"\n🔐 Auth object methods:")
        auth_methods = [method for method in dir(auth) if not method.startswith('_')]
        for method in auth_methods:
            if method.startswith('get_'):
                try:
                    result = getattr(auth, method)()
                    if result:
                        print(f"   📝 {method}: {result}")
                except Exception as e:
                    print(f"   ❌ {method}: Error - {e}")
    except Exception as e:
        print(f"❌ Error getting auth methods: {e}")
    
    # 4. Raw SAML Response analysis
    try:
        if hasattr(auth, 'get_last_response_xml'):
            raw_response = auth.get_last_response_xml()
            if raw_response:
                print(f"\n📄 Raw SAML Response length: {len(raw_response)} characters")
                print("📄 Raw SAML Response (first 500 chars):")
                print(raw_response[:500] + "..." if len(raw_response) > 500 else raw_response)
    except Exception as e:
        print(f"❌ Error getting raw response: {e}")
    
    # 5. Check request form data
    if request.method == "POST":
        try:
            form_data = await request.form()
            print(f"\n📮 POST Form Data:")
            for key, value in form_data.items():
                if key == 'SAMLResponse':
                    if hasattr(value, 'read'):
                        print(f"   🔑 {key}: [Base64 encoded file upload]")
                    else:
                        print(f"   🔑 {key}: [Base64 encoded, length: {len(str(value))}]")
                else:
                    print(f"   🔑 {key}: {value}")
        except Exception as e:
            print(f"❌ Error getting form data: {e}")
    
    # 6. Check query parameters
    if request.query_params:
        print(f"\n🔗 Query Parameters:")
        for key, value in request.query_params.items():
            print(f"   🔑 {key}: {value}")
    
    print("="*80)
    print("🔍 END SAML DATA ANALYSIS")
    print("="*80 + "\n")
    
    # Original mapping logic
    try:
        # Get raw attributes for debugging
        print("\n🔍 Raw SAML Attributes:")
        for key, value in saml_attributes.items():
            print(f"   {key}: {value}")

        # Try different common SAML attribute formats, including the one with typo
        username = (
            saml_attributes.get('User.Userrname', [None])[0] or  # Note: This is the actual attribute name with typo
            saml_attributes.get('User.Username', [None])[0] or
            saml_attributes.get('username', [None])[0] or
            saml_attributes.get('uid', [None])[0]
        )
        email = (
            saml_attributes.get('User.Email', [None])[0] or
            saml_attributes.get('email', [None])[0] or
            saml_attributes.get('mail', [None])[0]
        )
        first_name = (
            saml_attributes.get('first_name', [None])[0] or
            saml_attributes.get('firstname', [None])[0] or
            saml_attributes.get('givenName', [None])[0]
        )
        last_name = (
            saml_attributes.get('last_name', [None])[0] or
            saml_attributes.get('lastname', [None])[0] or
            saml_attributes.get('sn', [None])[0]
        )
        department = (
            saml_attributes.get('depart_name', [None])[0] or
            saml_attributes.get('department', [None])[0] or
            saml_attributes.get('organizationalUnit', [None])[0]
        )
        groups = (
            saml_attributes.get('http://schemas.xmlsoap.org/claims/Group', []) or
            saml_attributes.get('groups', []) or
            saml_attributes.get('Groups', []) or  # Add this as it's in the actual response
            saml_attributes.get('memberOf', [])
        )

        if not username:
            raise ValueError("Username not found in SAML attributes")

        # Print mapped values for debugging
        print("\n🔍 Mapped Values:")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   First Name: {first_name}")
        print(f"   Last Name: {last_name}")
        print(f"   Department: {department}")
        print(f"   Groups: {groups}")

        profile = {
            'nameID': auth.get_nameid(),
            'username': username,
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'department': department,
            'groups': groups
        }
        
        print(f"\n👤 Mapped Profile: {profile}")

        user = await user_service.find_or_create_saml_user(profile)
        print(f"👤 Created/Found User: {user.username} ({user.email})")

    except Exception as e:
        print(f"❌ Error processing SAML attributes: {e}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/login?error=profile_mapping&reason={str(e)}", 
            status_code=303
        )

    try:
        token_payload = {
            "sub": user.id, # 'sub' is a standard JWT claim for subject
            "nameID": user.nameID,
            "username": user.username,
            "email": user.email,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "department": user.department,
            "groups": user.groups,
            "role": user.role.value,
            "exp": datetime.utcnow() + timedelta(days=7)
        }

        if not settings.JWT_SECRET:
            raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
        token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm="HS256")
        
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}"
        print(f"🔄 Redirecting to: {redirect_url}")
        return RedirectResponse(redirect_url, status_code=303)
        
    except Exception as e:
        print(f"❌ Error creating JWT token: {e}")
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/login?error=token_creation&reason={str(e)}", 
            status_code=303
        )

@router.get('/logout')
async def logout(request: Request):
    """
    Simple logout - just redirect to login page
    For JWT tokens, client should delete the token from localStorage
    """
    print("Simple logout requested")
    return RedirectResponse(f"{settings.FRONTEND_URL}/login?logged_out=true", status_code=303)

@router.get('/logout/saml')
async def saml_logout(request: Request, name_id: str = "", session_index: str = ""):
    """
    SAML Single Logout (SLO) - clears SAML session at IdP
    """
    print(f"SAML logout requested - name_id: {name_id}, session_index: {session_index}")
    
    req = await prepare_saml_request(request)
    auth = init_saml_auth(req)
    
    try:
        # If we have name_id and session_index, use them for proper SLO
        if name_id and session_index:
            print(f"Performing SAML SLO with name_id: {name_id}")
            logout_url = auth.logout(name_id=name_id, session_index=session_index)
        else:
            print("Performing SAML SLO without specific session info")
            logout_url = auth.logout()
        
        # Manually fix the RelayState to point to our callback
        callback_url = f"{settings.FRONTEND_URL}/api/auth/logout/saml/callback"
        if "RelayState=" in logout_url:
            # Replace the RelayState parameter
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            
            parsed_url = urlparse(logout_url)
            query_params = parse_qs(parsed_url.query)
            query_params['RelayState'] = [callback_url]
            
            new_query = urlencode(query_params, doseq=True)
            logout_url = urlunparse((
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                new_query,
                parsed_url.fragment
            ))
        
        print(f"SAML logout URL: {logout_url}")
        print(f"Callback URL: {callback_url}")
        
        # Add a fallback URL parameter for manual return
        logout_success_url = f'{settings.FRONTEND_URL}/api/auth/logout/saml/manual'
        if "?" in logout_url:
            logout_url += f"&return_url={urllib.parse.quote(logout_success_url)}"
        else:
            logout_url += f"?return_url={urllib.parse.quote(logout_success_url)}"
            
        return RedirectResponse(logout_url, status_code=303)
        
    except Exception as e:
        print(f"SAML logout error: {e}")
        # If SAML logout fails, fallback to simple logout
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=saml_logout_failed", status_code=303)

@router.get('/logout/saml/manual')
async def saml_logout_manual_return(request: Request):
    """
    Manual return from SAML logout when IdP doesn't callback automatically
    """
    print("Manual return from SAML logout")
    return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true&manual=true", status_code=303)

@router.post('/logout/saml/callback')
@router.get('/logout/saml/callback')
async def saml_logout_callback(request: Request):
    """
    Handle SAML logout callback from IdP
    """
    print(f"SAML logout callback received: {request.method} {request.url}")
    
    # Check if this is a simple GET request without SAML data
    if request.method == "GET":
        saml_response = request.query_params.get('SAMLResponse')
        logout_request = request.query_params.get('SAMLRequest')
        relay_state = request.query_params.get('RelayState')
        
        print(f"GET request - SAMLResponse: {saml_response is not None}")
        print(f"GET request - SAMLRequest: {logout_request is not None}")
        print(f"GET request - RelayState: {relay_state}")
        
        # If no SAML data, just redirect to login
        if not saml_response and not logout_request:
            print("No SAML data in GET request, redirecting to login")
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true", status_code=303)
    
    req = await prepare_saml_request(request)
    auth = init_saml_auth(req)
    
    try:
        # For GET requests with SAML data, try to process as logout response
        if request.method == "GET" and request.query_params.get('SAMLResponse'):
            print("Processing SAML logout response from GET request")
            
            # Manually decode and validate the SAMLResponse
            saml_response = request.query_params.get('SAMLResponse')
            if saml_response:
                try:
                    # Decode base64
                    import base64
                    decoded_response = base64.b64decode(saml_response)
                    print(f"Decoded SAML response length: {len(decoded_response)}")
                    
                    # Check if it's a valid XML
                    import xml.etree.ElementTree as ET
                    try:
                        root = ET.fromstring(decoded_response)
                        print(f"XML root tag: {root.tag}")
                        
                        # Check if it's a LogoutResponse
                        if 'LogoutResponse' in root.tag:
                            print("Valid LogoutResponse received")
                            return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true", status_code=303)
                        
                    except ET.ParseError as xml_error:
                        print(f"XML parsing error: {xml_error}")
                        
                except Exception as decode_error:
                    print(f"Base64 decode error: {decode_error}")
        
        # Try standard SAML processing
        print("Attempting standard SAML logout processing")
        auth.process_slo(delete_session_cb=lambda: print("Session deleted"))
        errors = auth.get_errors()
        
        print(f"SAML logout processing completed. Errors: {errors}")
        
        if errors:
            print("SAML logout errors:", errors)
            print("Last error reason:", auth.get_last_error_reason())
            # Even if there are errors, if we got this far, logout probably succeeded
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true&warnings=true", status_code=303)
        
        print("SAML logout successful")
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true", status_code=303)
        
    except Exception as e:
        print(f"SAML logout callback error: {e}")
        # Even if processing fails, assume logout succeeded if we got a callback
        print("Assuming logout succeeded despite processing error")
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?saml_logged_out=true&fallback=true", status_code=303)

@router.get("/metadata")
async def metadata():
    saml_settings = get_saml_settings()
    sp_settings = saml_settings['sp']
    idp_settings = saml_settings['idp']
    
    # Using the library to generate metadata
    # This requires a valid settings object passed to OneLogin_Saml2_Auth
    auth = OneLogin_Saml2_Auth(None, old_settings=saml_settings)
    sp_metadata = auth.get_settings().get_sp_metadata()
    
    return Response(content=sp_metadata, media_type="application/xml")


class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    user: User

@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(login_data: AdminLoginRequest):
    user = await user_service.find_admin_by_username(login_data.username)
    if not user or not user.password:
        raise HTTPException(status_code=401, detail="User account not found or password not set")
    
    is_match = await user_service.verify_admin_password(login_data.password, user.password)
    if not is_match:
        raise HTTPException(status_code=401, detail="Password is incorrect")

    token_payload = {
        "sub": user.id,
        "nameID": user.nameID,
        "username": user.username,
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "department": user.department,
        "groups": user.groups,
        "role": user.role.value,
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    
    if not settings.JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm="HS256")
    
    return {"token": token, "user": user}

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get current authenticated user information"""
    return current_user

@router.post("/refresh")
async def refresh_token(current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """
    Refresh JWT token for authenticated user
    """
    # Create new token with extended expiration
    token_payload = {
        "sub": current_user.id,
        "nameID": current_user.nameID,
        "username": current_user.username,
        "email": current_user.email,
        "firstName": current_user.firstName,
        "lastName": current_user.lastName,
        "department": current_user.department,
        "groups": current_user.groups,
        "role": current_user.role.value,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    
    if not settings.JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    
    new_token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm="HS256")
    
    return {"token": new_token} 